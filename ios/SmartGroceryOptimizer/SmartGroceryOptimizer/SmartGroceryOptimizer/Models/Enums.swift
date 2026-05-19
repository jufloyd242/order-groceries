import Foundation

// MARK: - Shared Enums
// Mirrors: types/index.ts — StoreId, status, source, order_modality

/// Supported store identifiers
enum StoreId: String, Codable, CaseIterable {
    case kroger
    case amazon
    case walmart
    case instacart
}

// MARK: - Store Capabilities
// Mirrors: types/index.ts — StoreCapability, STORE_CAPABILITIES

/// Declares what a store can do — drives UX branching and cleanup logic
struct StoreCapability {
    let canSearch: Bool
    let canPrice: Bool
    /// Store supports programmatic add-to-cart (e.g. Kroger API)
    let canAutoCart: Bool
    /// Items must be manually added by user via browser link
    let requiresUserHandoff: Bool
}

/// Source-of-truth capability declarations per store
let storeCapabilities: [StoreId: StoreCapability] = [
    .kroger: StoreCapability(canSearch: true, canPrice: true, canAutoCart: true, requiresUserHandoff: false),
    .amazon: StoreCapability(canSearch: true, canPrice: true, canAutoCart: false, requiresUserHandoff: true),
    .walmart: StoreCapability(canSearch: false, canPrice: false, canAutoCart: false, requiresUserHandoff: true),
    .instacart: StoreCapability(canSearch: false, canPrice: false, canAutoCart: false, requiresUserHandoff: true),
]

/// Shopping list item status
enum ItemStatus: String, Codable {
    case pending
    case matched
    case compared
    case carted
    case purchased
}

/// How the item was added
enum ItemSource: String, Codable {
    case manual
    case todoist
}

/// Kroger fulfillment mode
enum OrderModality: String, Codable {
    case delivery = "DELIVERY"
    case pickup = "PICKUP"
}

/// Price comparison winner (superset of StoreId — adds "tie")
enum Winner: String, Codable {
    case kroger
    case amazon
    case tie
}
