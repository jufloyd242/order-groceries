import Foundation

// MARK: - Cart Submission
// Mirrors: types/index.ts — StoreSubmitResult, CartSubmitResult, AmazonHandoffLink

/// Result of submitting one store's cart items
struct StoreSubmitResult: Codable, Equatable {
    let store: StoreId
    let success: Bool
    let itemsAdded: Int
    let itemsFailed: Int
    /// Number of items prepared for user handoff (not auto-added)
    let handoffReady: Int?
    let errors: [String]
    /// If Kroger auth is required, the OAuth redirect URL
    let authUrl: String?
}

/// A single Amazon product link for user-assisted add-to-cart
struct AmazonHandoffLink: Codable, Identifiable, Equatable {
    let asin: String
    let name: String
    let url: String
    let quantity: Int
    let listItemId: String?

    var id: String { asin }
}

/// Full cart submission response from POST /api/cart/submit
struct CartSubmitResult: Codable, Equatable {
    let results: [StoreSubmitResult]
    /// IDs of items that were programmatically added (auto-cart stores only)
    let submittedIds: [String]
    /// Per-item Amazon links for user-assisted handoff
    let amazonLinks: [AmazonHandoffLink]?
}
