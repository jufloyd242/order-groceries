import Foundation

// MARK: - API Errors

/// Errors thrown by APIClient
enum APIError: LocalizedError {
    /// HTTP status code outside 200-299
    case httpError(statusCode: Int, message: String?)
    /// Server returned { success: false, error: "..." }
    case serverError(message: String)
    /// Response body couldn't be decoded
    case decodingError(underlying: Error)
    /// No network, timeout, etc.
    case networkError(underlying: Error)
    /// Auth session missing or expired
    case unauthenticated

    var errorDescription: String? {
        switch self {
        case .httpError(let code, let message):
            return message ?? "HTTP error \(code)"
        case .serverError(let message):
            return message
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .unauthenticated:
            return "Please sign in to continue"
        }
    }
}
