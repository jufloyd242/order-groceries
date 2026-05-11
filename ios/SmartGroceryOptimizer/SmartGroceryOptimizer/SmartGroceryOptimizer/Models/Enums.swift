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
