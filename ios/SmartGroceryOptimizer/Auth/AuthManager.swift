import Foundation
import AuthenticationServices

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

    private init() {
        restoreSession()
    }

    // MARK: - Google OAuth Sign In

    /// Start Google OAuth sign-in via Supabase
    /// Uses ASWebAuthenticationSession to open the Supabase OAuth URL,
    /// which handles the Google redirect and sets session cookies.
    func signInWithGoogle(presentationAnchor: ASPresentationAnchor) async throws {
        isLoading = true
        defer { isLoading = false }

        let supabaseURL = APIConfig.supabaseURL.absoluteString
        let callbackURL = APIConfig.url(for: "/api/auth/callback").absoluteString

        // Build the Supabase OAuth URL (same as the web app's signInWithOAuth)
        var components = URLComponents(string: "\(supabaseURL)/auth/v1/authorize")!
        components.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: callbackURL),
        ]

        guard let authURL = components.url else {
            throw APIError.networkError(underlying: URLError(.badURL))
        }

        // Open the OAuth flow in a system browser sheet
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
            session.presentationContextProvider = PresentationContextProvider(anchor: presentationAnchor)
            session.prefersEphemeralWebBrowserSession = false // Keep cookies
            session.start()
        }

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
            isAuthenticated = true
            userEmail = KeychainHelper.load(key: userEmailKey)

            // Validate token is still valid
            Task { await refreshSession() }
        }
    }

    /// Refresh the current session by calling a lightweight API endpoint
    func refreshSession() async {
        do {
            // Hit settings endpoint as a lightweight auth check
            let response: APIResponse<SettingsResponse> = try await APIClient.shared.get("/api/settings")
            if response.success {
                isAuthenticated = true
            } else {
                await handleSessionExpired()
            }
        } catch let error as APIError {
            if case .unauthenticated = error {
                await handleSessionExpired()
            }
            // Network errors don't mean we're logged out
        } catch {
            // Ignore — could be offline
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

    /// Handle an expired or invalid session
    private func handleSessionExpired() async {
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
        await handleSessionExpired()
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
