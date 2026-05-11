import Foundation

// MARK: - API Client
// URLSession-based networking layer that calls the Next.js /api/* routes.
// Auth: injects Supabase session cookies via a shared cookie store so the
// existing middleware.ts cookie-based auth works unchanged.

final class APIClient {
    static let shared = APIClient()

    /// Shared URLSession with cookie storage enabled (persists Supabase auth cookies)
    private let session: URLSession

    /// Cookie storage shared with ASWebAuthenticationSession for OAuth
    let cookieStorage: HTTPCookieStorage

    private init() {
        cookieStorage = HTTPCookieStorage.shared

        let config = URLSessionConfiguration.default
        config.httpCookieStorage = cookieStorage
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60

        // Allow localhost HTTP in dev (requires NSAppTransportSecurity in Info.plist)
        session = URLSession(configuration: config)
    }

    // MARK: - GET

    /// Perform a GET request and decode the response
    /// - Parameters:
    ///   - path: API path (e.g. "/api/list")
    ///   - queryItems: Optional query parameters
    /// - Returns: Decoded response of type T
    func get<T: Decodable>(
        _ path: String,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        var url = APIConfig.url(for: path)

        if let queryItems, !queryItems.isEmpty {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            components.queryItems = queryItems
            url = components.url!
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        injectAuthHeaders(&request)

        return try await perform(request)
    }

    // MARK: - POST

    /// Perform a POST request with a JSON body and decode the response
    /// - Parameters:
    ///   - path: API path (e.g. "/api/list")
    ///   - body: Encodable body (will be JSON-encoded)
    /// - Returns: Decoded response of type T
    func post<Body: Encodable, T: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> T {
        let url = APIConfig.url(for: path)

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(body)
        injectAuthHeaders(&request)

        return try await perform(request)
    }

    /// POST with no request body
    func post<T: Decodable>(_ path: String) async throws -> T {
        let url = APIConfig.url(for: path)

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        injectAuthHeaders(&request)

        return try await perform(request)
    }

    // MARK: - PATCH

    /// Perform a PATCH request with no body
    func patch<T: Decodable>(_ path: String) async throws -> T {
        let url = APIConfig.url(for: path)

        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        injectAuthHeaders(&request)

        return try await perform(request)
    }

    /// Perform a PATCH request with a JSON body
    func patch<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = APIConfig.url(for: path)

        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(body)
        injectAuthHeaders(&request)

        return try await perform(request)
    }

    // MARK: - DELETE

    /// Perform a DELETE request
    func delete<T: Decodable>(_ path: String) async throws -> T {
        let url = APIConfig.url(for: path)

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        injectAuthHeaders(&request)

        return try await perform(request)
    }

    /// Perform a DELETE request with a JSON body (for endpoints that need it)
    func delete<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = APIConfig.url(for: path)

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(body)
        injectAuthHeaders(&request)

        return try await perform(request)
    }

    // MARK: - Core Request Execution

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(underlying: error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(underlying: URLError(.badServerResponse))
        }

        // Handle auth failures
        if httpResponse.statusCode == 401 {
            throw APIError.unauthenticated
        }

        // Handle HTTP errors
        guard (200...299).contains(httpResponse.statusCode) else {
            // Try to extract error message from response body
            let message = extractErrorMessage(from: data)
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: message)
        }

        // Decode the response
        do {
            return try JSONDecoder.sgo.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(underlying: error)
        }
    }

    // MARK: - Auth Header Injection

    /// Injects the Supabase access token as a Bearer header.
    /// The cookie-based auth is automatic via HTTPCookieStorage, but
    /// API routes also accept Authorization headers as a fallback.
    private func injectAuthHeaders(_ request: inout URLRequest) {
        if let token = AuthManager.shared.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    // MARK: - Helpers

    private func extractErrorMessage(from data: Data) -> String? {
        struct ErrorBody: Decodable {
            let error: String?
        }
        return try? JSONDecoder().decode(ErrorBody.self, from: data).error
    }

    // MARK: - Cookie Management

    /// Check if we have valid Supabase auth cookies
    var hasAuthCookies: Bool {
        let cookies = cookieStorage.cookies(for: APIConfig.baseURL) ?? []
        return cookies.contains { $0.name.contains("sb-") && $0.name.contains("auth-token") }
    }

    /// Clear all cookies (logout)
    func clearCookies() {
        if let cookies = cookieStorage.cookies(for: APIConfig.baseURL) {
            cookies.forEach { cookieStorage.deleteCookie($0) }
        }
        // Also clear Supabase cookies
        if let supabaseURL = APIConfig.supabaseURL,
           let cookies = cookieStorage.cookies(for: supabaseURL) {
            cookies.forEach { cookieStorage.deleteCookie($0) }
        }
    }
}
