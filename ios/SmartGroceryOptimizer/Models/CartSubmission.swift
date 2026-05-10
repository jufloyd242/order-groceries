import Foundation

// MARK: - Cart Submission
// Mirrors: types/index.ts — StoreSubmitResult, CartSubmitResult

/// Result of submitting one store's cart items
struct StoreSubmitResult: Codable, Equatable {
    let store: StoreId
    let success: Bool
    let itemsAdded: Int
    let itemsFailed: Int
    let errors: [String]
    /// If Kroger auth is required, the OAuth redirect URL
    let authUrl: String?
}

/// Full cart submission response from POST /api/cart/submit
struct CartSubmitResult: Codable, Equatable {
    let results: [StoreSubmitResult]
    let submittedIds: [String]
}
