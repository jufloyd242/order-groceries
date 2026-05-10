import Foundation

// MARK: - Cart Item
// Mirrors: types/index.ts — CartItem, CartByStore

/// A single item in the unified cart
struct CartItem: Codable, Identifiable, Equatable {
    /// Unique key: `${store}-${productId}`
    let id: String
    let store: StoreId
    let name: String
    let brand: String
    let price: Double
    var quantity: Int
    let imageUrl: String?
    let size: String
    let upc: String?
    let asin: String?
    let listItemId: String?
    let addedAt: TimeInterval

    enum CodingKeys: String, CodingKey {
        case id, store, name, brand, price, quantity
        case imageUrl = "image_url"
        case size, upc, asin
        case listItemId
        case addedAt
    }

    /// Convenience: `addedAt` as a Date
    var addedDate: Date {
        Date(timeIntervalSince1970: addedAt / 1000) // JS timestamps are ms
    }
}

/// Cart grouped by store for display / submission
struct CartByStore: Codable, Equatable {
    let kroger: [CartItem]
    let amazon: [CartItem]
}
