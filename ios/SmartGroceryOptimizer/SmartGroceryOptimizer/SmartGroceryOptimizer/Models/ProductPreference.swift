import Foundation

// MARK: - Product Preferences
// Mirrors: types/index.ts — ProductPreference, NewProductPreference

/// "Learn once, remember forever" — saved product mapping
struct ProductPreference: Codable, Identifiable, Equatable {
    let id: String
    let genericName: String
    let displayName: String
    let preferredUpc: String?
    let preferredAsin: String?
    let preferredStore: StoreId?
    let preferredBrand: String?
    let searchOverride: String?
    let lastKrogerPrice: Double?
    let lastAmazonPrice: Double?
    let timesPurchased: Int
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case genericName = "generic_name"
        case displayName = "display_name"
        case preferredUpc = "preferred_upc"
        case preferredAsin = "preferred_asin"
        case preferredStore = "preferred_store"
        case preferredBrand = "preferred_brand"
        case searchOverride = "search_override"
        case lastKrogerPrice = "last_kroger_price"
        case lastAmazonPrice = "last_amazon_price"
        case timesPurchased = "times_purchased"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// POST body for saving/updating a product preference
struct NewProductPreference: Codable {
    let genericName: String
    let displayName: String
    var preferredUpc: String?
    var preferredAsin: String?
    var preferredStore: StoreId?
    var preferredBrand: String?
    var searchOverride: String?

    enum CodingKeys: String, CodingKey {
        case genericName = "generic_name"
        case displayName = "display_name"
        case preferredUpc = "preferred_upc"
        case preferredAsin = "preferred_asin"
        case preferredStore = "preferred_store"
        case preferredBrand = "preferred_brand"
        case searchOverride = "search_override"
    }
}
