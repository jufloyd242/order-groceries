import Foundation
import AuthenticationServices
import Combine

// MARK: - Auth Manager
// Wraps Supabase authentication for the iOS app.
// Uses Google OAuth via ASWebAuthenticationSession (same flow as the web app).
// Stores the session token for APIClient to inject into requests.

@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    /// Current access token (JWT) for API requests
    @Published private(set) var accessToken: String?
    /// Current user info
    @Published private(set) var userEmail: String?
    /// Whether the user is authenticated
    @Published private(set) var isAuthenticated = false
    /// Loading state for auth operations
    @Published private(set) var isLoading = false

    private let tokenKey = "sgo_access_token"
    private let refreshTokenKey = "sgo_refresh_token"
    private let userEmailKey = "sgo_user_email"

    /// Guards against concurrent refreshSession() calls (e.g. from init + ContentView.task)
    private var isRefreshingSession = false

    // Retained during ASWebAuthenticationSession flow.
    // ASWebAuthenticationSession.presentationContextProvider is a weak var,
    // so both objects must be held strongly or they are immediately deallocated.
    private var authSession: ASWebAuthenticationSession?
    private var authSessionContext: PresentationContextProvider?

    private init() {
        restoreSession()
    }

    // MARK: - Dev Bypass (simulator only)

    /// Directly inject a Supabase access token — used in the simulator to bypass
    /// the Google OAuth web form (which the iOS Form Assistant toolbar blocks).
    /// Validates the token against the server before accepting it.
    /// Throws `APIError.unauthenticated` if the token is expired/invalid.
    func setSessionFromToken(_ token: String) async throws {
        accessToken = token
        isLoading = true
        defer { isLoading = false }

        KeychainHelper.save(key: tokenKey, value: token)

        // Validate the token by hitting a lightweight endpoint
        do {
            let response: APIResponse<SettingsResponse> = try await APIClient.shared.get("/api/settings")
            if response.success {
                isAuthenticated = true
                if let email = decodeJWTEmail(token) {
                    userEmail = email
                    KeychainHelper.save(key: userEmailKey, value: email)
                }
            } else {
                accessToken = nil
                KeychainHelper.delete(key: tokenKey)
                throw APIError.serverError(message: "Token rejected by server")
            }
        } catch {
            accessToken = nil
            KeychainHelper.delete(key: tokenKey)
            throw error
        }
    }

    // MARK: - Google OAuth Sign In

    /// Start Google OAuth sign-in via Supabase
    /// Uses ASWebAuthenticationSession to open the Supabase OAuth URL,
    /// which handles the Google redirect and sets session cookies.
    func signInWithGoogle(presentationAnchor: ASPresentationAnchor) async throws {
        isLoading = true
        defer { isLoading = false }

        guard let supabaseURL = APIConfig.supabaseURL else {
            throw APIError.serverError(message: "Supabase URL not configured. Fill in ios/SGO.xcconfig with your project credentials.")
        }

        // redirect_to MUST use the app's custom URL scheme, not http://localhost.
        // ASWebAuthenticationSession intercepts the redirect only when it matches callbackURLScheme.
        // Using http://localhost causes Supabase to redirect the embedded browser there, which
        // opens the Next.js /api/auth/callback page and shows a second Supabase login form.
        // This URI must also be whitelisted in Supabase → Auth → URL Configuration → Redirect URLs.
        let callbackURL = "smartgroceryoptimizer://auth/callback"

        // Build the Supabase OAuth URL
        var components = URLComponents(string: "\(supabaseURL.absoluteString)/auth/v1/authorize")!
        components.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: callbackURL),
        ]

        guard let authURL = components.url else {
            throw APIError.networkError(underlying: URLError(.badURL))
        }

        // Open the OAuth flow in a system browser sheet
        let contextProvider = PresentationContextProvider(anchor: presentationAnchor)
        authSessionContext = contextProvider // strong reference — presentationContextProvider is weak

        let resultURL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: "smartgroceryoptimizer"
            ) { url, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let url {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(throwing: APIError.unauthenticated)
                }
            }
            session.presentationContextProvider = contextProvider
            // Use shared Safari session (prefersEphemeralWebBrowserSession = false) so existing
            // Google account cookies from Safari are available. This shows the "Choose an account"
            // picker if the user is already signed into Google in Safari — bypassing the email/password
            // form and the iOS Form Assistant toolbar that was intercepting "Next".
            // The original double-login bug was caused by redirect_to pointing to http://localhost
            // (now fixed to smartgroceryoptimizer://auth/callback), NOT by this setting.
            session.prefersEphemeralWebBrowserSession = false
            authSession = session // strong reference — keeps session alive until callback fires
            session.start()
        }
        authSession = nil
        authSessionContext = nil

        // After OAuth completes, extract tokens from the callback URL
        // Supabase redirects with fragment: #access_token=...&refresh_token=...&...
        try handleAuthCallback(url: resultURL)
    }

    // MARK: - Session Token Exchange

    /// Exchange auth code or extract tokens from Supabase callback URL
    private func handleAuthCallback(url: URL) throws {
        // Supabase can return tokens in the fragment (#) or as query params
        // Fragment format: #access_token=xxx&refresh_token=xxx&token_type=bearer&...
        let fragment = url.fragment ?? ""
        let query = url.query ?? ""
        let combined = fragment.isEmpty ? query : fragment

        let params = parseQueryString(combined)

        if let accessToken = params["access_token"] {
            self.accessToken = accessToken
            self.isAuthenticated = true

            // Store tokens securely
            KeychainHelper.save(key: tokenKey, value: accessToken)

            if let refreshToken = params["refresh_token"] {
                KeychainHelper.save(key: refreshTokenKey, value: refreshToken)
            }

            // Fetch user info
            Task { await fetchUserInfo() }
        } else if let code = params["code"] {
            // If we got an auth code, exchange it via our API callback
            // The cookies will be set automatically by the URLSession
            Task {
                do {
                    let _: EmptyResponse = try await APIClient.shared.get(
                        "/api/auth/callback",
                        queryItems: [URLQueryItem(name: "code", value: code)]
                    )
                    await refreshSession()
                } catch {
                    print("Auth code exchange failed: \(error)")
                }
            }
        } else {
            throw APIError.unauthenticated
        }
    }

    // MARK: - Session Management

    /// Try to restore a saved session on app launch
    private func restoreSession() {
        if let token = KeychainHelper.load(key: tokenKey) {
            accessToken = token
            userEmail = KeychainHelper.load(key: userEmailKey)
            // Show splash while we validate the saved token (avoids briefly
            // showing the main list with an expired token → "Session expired" flash).
            isLoading = true

            // Validate token is still valid (or attempt silent refresh)
            Task { await refreshSession() }
        }
    }

    /// Refresh the current session by calling a lightweight API endpoint.
    /// Attempts silent token refresh if the access token has expired.
    func refreshSession() async {
        guard !isRefreshingSession else { return }
        isRefreshingSession = true
        // Capture the token we're about to validate. If a new token is set before
        // this completes (e.g. dev bypass token pasted), we must not clear it.
        let tokenAtStart = accessToken
        defer {
            isRefreshingSession = false
            isLoading = false
        }

        do {
            // Hit settings endpoint as a lightweight auth check
            let response: APIResponse<SettingsResponse> = try await APIClient.shared.get("/api/settings")
            if response.success {
                isAuthenticated = true
                // Check linked service statuses in parallel
                async let kroger: () = checkKrogerStatus()
                async let todoist: () = checkTodoistStatus()
                _ = await (kroger, todoist)
            } else {
                await handleSessionExpired(tokenAtStart: tokenAtStart)
            }
        } catch let error as APIError {
            if case .unauthenticated = error {
                // Access token expired — try a silent refresh before forcing re-login
                let refreshed = await refreshAccessToken()
                if refreshed {
                    // New token stored — session is valid again
                    isAuthenticated = true
                    async let kroger: () = checkKrogerStatus()
                    async let todoist: () = checkTodoistStatus()
                    _ = await (kroger, todoist)
                } else {
                    // Refresh token also expired or missing — require re-login
                    await handleSessionExpired(tokenAtStart: tokenAtStart)
                }
            }
            // Network errors don't mean we're logged out — preserve auth state
        } catch {
            // Ignore — could be offline
        }
    }

    /// Use the stored Supabase refresh token to silently obtain a new access token.
    /// Stores the new tokens in Keychain and updates `accessToken` on success.
    /// Returns `true` if a fresh access token was obtained.
    private func refreshAccessToken() async -> Bool {
        guard let refreshToken = KeychainHelper.load(key: refreshTokenKey),
              let supabaseURL = APIConfig.supabaseURL,
              let anonKey = APIConfig.supabaseAnonKey else {
            return false
        }

        var components = URLComponents(url: supabaseURL.appendingPathComponent("/auth/v1/token"),
                                       resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        guard let url = components.url else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        guard let body = try? JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken]) else {
            return false
        }
        request.httpBody = body

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let newAccessToken = json["access_token"] as? String else {
                return false
            }

            accessToken = newAccessToken
            KeychainHelper.save(key: tokenKey, value: newAccessToken)
            if let newRefreshToken = json["refresh_token"] as? String {
                KeychainHelper.save(key: refreshTokenKey, value: newRefreshToken)
            }
            return true
        } catch {
            return false
        }
    }

    /// Fetch current user email from Supabase
    private func fetchUserInfo() async {
        // The user info is embedded in the JWT — decode it
        guard let token = accessToken else { return }
        if let email = decodeJWTEmail(token) {
            userEmail = email
            KeychainHelper.save(key: userEmailKey, value: email)
        }
    }

    /// Clear all stored auth state and navigate to login.
    /// Called unconditionally — e.g. when an API request returns 401 mid-session.
    func sessionExpired() {
        clearSession()
    }

    /// Guard-wrapped expiry: only clears auth if the token hasn't been replaced
    /// since the check started (prevents a racing refreshSession from wiping a
    /// freshly-pasted dev token or a just-completed OAuth sign-in).
    private func handleSessionExpired(tokenAtStart: String?) async {
        guard accessToken == tokenAtStart else { return }
        clearSession()
    }

    /// Unconditionally wipe all auth state.
    private func clearSession() {
        accessToken = nil
        isAuthenticated = false
        userEmail = nil
        KeychainHelper.delete(key: tokenKey)
        KeychainHelper.delete(key: refreshTokenKey)
        KeychainHelper.delete(key: userEmailKey)
        APIClient.shared.clearCookies()
    }

    /// Sign out and clear all stored credentials
    func signOut() async {
        // Call Supabase signout endpoint to invalidate server session
        do {
            let _: EmptyResponse = try await APIClient.shared.post("/api/auth/signout")
        } catch {
            // Best-effort — clear local state regardless
        }
        clearSession()
    }

    // MARK: - JWT Helpers

    /// Extract email from a Supabase JWT (base64-decoded payload)
    private func decodeJWTEmail(_ jwt: String) -> String? {
        let parts = jwt.split(separator: ".")
        guard parts.count == 3 else { return nil }

        var payload = String(parts[1])
        // Pad base64 if needed
        let remainder = payload.count % 4
        if remainder > 0 {
            payload += String(repeating: "=", count: 4 - remainder)
        }

        guard let data = Data(base64Encoded: payload),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let email = json["email"] as? String else {
            return nil
        }
        return email
    }

    /// Parse a URL query/fragment string into key-value pairs
    private func parseQueryString(_ string: String) -> [String: String] {
        var result: [String: String] = [:]
        for pair in string.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1)
            if parts.count == 2 {
                let key = String(parts[0])
                let value = String(parts[1]).removingPercentEncoding ?? String(parts[1])
                result[key] = value
            }
        }
        return result
    }

    // MARK: - King Soopers (Kroger) OAuth

    /// Whether the current user has linked their King Soopers account
    @Published private(set) var isKrogerLinked: Bool = false

    /// Check if the user has linked their King Soopers account
    func checkKrogerStatus() async {
        struct StatusResponse: Decodable { let linked: Bool }
        do {
            let response: StatusResponse = try await APIClient.shared.get("/api/kroger/auth/status")
            isKrogerLinked = response.linked
        } catch {
            // Not linked or network error — keep current state
        }
    }

    /// Link the user's King Soopers account via OAuth.
    /// Opens the Kroger login page in a system browser sheet (ASWebAuthenticationSession).
    /// The user's Supabase JWT is passed as the OAuth `state` param so the server
    /// callback can authenticate without cookies.
    func linkKingSoopers(presentationAnchor: ASPresentationAnchor) async throws {
        // 1. Get the Kroger auth URL from the backend
        struct AuthorizeResponse: Decodable { let authUrl: String }
        let authorizeResponse: AuthorizeResponse = try await APIClient.shared.get(
            "/api/kroger/auth/authorize"
        )

        // 2. Append the user's JWT as `state` so the callback can auth without cookies.
        //    IMPORTANT: do NOT use URLComponents to re-parse + re-encode the server URL.
        //    URLSearchParams (TypeScript) encodes spaces as `+` in query values, but
        //    URLComponents.queryItems does NOT decode `+` as space. Re-serialising via
        //    URLComponents would turn `+` → `%2B`, corrupting the OAuth scope and causing
        //    Kroger to reject the request before showing the login page.
        let jwt = accessToken ?? ""
        // JWTs use base64url (alphanumeric + `-` `_` `.`) — no encoding needed.
        let separator = authorizeResponse.authUrl.contains("?") ? "&" : "?"
        let krogerAuthUrlString = authorizeResponse.authUrl + "\(separator)state=\(jwt)"

        guard let krogerAuthURL = URL(string: krogerAuthUrlString) else {
            throw APIError.serverError(message: "Failed to build Kroger auth URL")
        }

        // 3. Open Kroger login in a browser sheet
        let contextProvider = PresentationContextProvider(anchor: presentationAnchor)
        authSessionContext = contextProvider

        let resultURL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(
                url: krogerAuthURL,
                callbackURLScheme: "smartgroceryoptimizer"
            ) { url, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let url {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(throwing: APIError.unauthenticated)
                }
            }
            session.presentationContextProvider = contextProvider
            session.prefersEphemeralWebBrowserSession = true // Kroger login: use ephemeral to avoid account confusion
            authSession = session
            session.start()
        }
        authSession = nil
        authSessionContext = nil

        // 4. Callback URL is `smartgroceryoptimizer://kroger/linked` on success
        //    or `smartgroceryoptimizer://kroger/error?reason=...` on failure
        guard resultURL.host == "kroger", resultURL.path == "/linked" else {
            let params = parseQueryString(resultURL.query ?? "")
            let reason = params["reason"] ?? "Unknown error"
            throw APIError.serverError(message: "Kroger login failed: \(reason)")
        }

        isKrogerLinked = true
    }

    /// Remove the user's King Soopers account link
    func unlinkKingSoopers() async {
        struct UnlinkResponse: Decodable { let success: Bool? }
        do {
            let _: UnlinkResponse = try await APIClient.shared.delete("/api/kroger/auth/unlink")
            isKrogerLinked = false
        } catch {
            // Best-effort
        }
    }

    // MARK: - Todoist OAuth

    /// Whether the current user has linked their Todoist account
    @Published private(set) var isTodoistLinked: Bool = false

    /// Check if the user has linked their Todoist account
    func checkTodoistStatus() async {
        struct StatusResponse: Decodable { let linked: Bool }
        do {
            let response: StatusResponse = try await APIClient.shared.get("/api/todoist/auth/status")
            isTodoistLinked = response.linked
        } catch {
            // Not linked or network error — keep current state
        }
    }

    /// Link the user's Todoist account via OAuth.
    /// Opens the Todoist login page in a system browser sheet (ASWebAuthenticationSession).
    func linkTodoist(presentationAnchor: ASPresentationAnchor) async throws {
        // 1. Get the Todoist auth URL from the backend
        struct AuthorizeResponse: Decodable { let authUrl: String }
        let jwt = accessToken ?? ""
        let authorizeResponse: AuthorizeResponse = try await APIClient.shared.get(
            "/api/todoist/auth/authorize",
            queryItems: [URLQueryItem(name: "state", value: jwt)]
        )

        guard let todoistAuthURL = URL(string: authorizeResponse.authUrl) else {
            throw APIError.serverError(message: "Invalid auth URL from server")
        }

        // 2. Open Todoist login in a browser sheet
        let contextProvider = PresentationContextProvider(anchor: presentationAnchor)
        authSessionContext = contextProvider

        let resultURL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(
                url: todoistAuthURL,
                callbackURLScheme: "smartgroceryoptimizer"
            ) { url, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let url {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(throwing: APIError.unauthenticated)
                }
            }
            session.presentationContextProvider = contextProvider
            session.prefersEphemeralWebBrowserSession = false
            authSession = session
            session.start()
        }
        authSession = nil
        authSessionContext = nil

        // 3. Callback URL is `smartgroceryoptimizer://todoist/linked` on success
        guard resultURL.host == "todoist", resultURL.path == "/linked" else {
            let params = parseQueryString(resultURL.query ?? "")
            let reason = params["reason"] ?? "Unknown error"
            throw APIError.serverError(message: "Todoist login failed: \(reason)")
        }

        isTodoistLinked = true
    }

    /// Remove the user's Todoist account link
    func unlinkTodoist() async {
        struct UnlinkResponse: Decodable { let success: Bool? }
        do {
            let _: UnlinkResponse = try await APIClient.shared.delete("/api/todoist/auth/unlink")
            isTodoistLinked = false
        } catch {
            // Best-effort
        }
    }
}

// MARK: - ASWebAuthenticationSession Presentation

private final class PresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    let anchor: ASPresentationAnchor

    init(anchor: ASPresentationAnchor) {
        self.anchor = anchor
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchor
    }
}

// MARK: - Empty response for endpoints that redirect or return minimal data

private struct EmptyResponse: Decodable {}
