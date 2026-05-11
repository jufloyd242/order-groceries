import Foundation

// MARK: - Product Match
// Mirrors: types/index.ts — ProductMatch (aka NormalizedProduct)

/// Canonical product shape returned by all store adapters
struct ProductMatch: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let brand: String
    let price: Double
    let promoPrice: Double?
    let size: String
    let unit: String
    let pricePerUnit: Double
    let imageUrl: String?
    let store: StoreId
    let upc: String?
    let asin: String?
    let isPrime: Bool?
    let matchScore: Double
    let aiReasoning: String?
    let normalizedTotalQty: Double?
    let normalizedQtyUnit: String?
    let department: String?
    let link: String?

    enum CodingKeys: String, CodingKey {
        case id, name, brand, price
        case promoPrice = "promo_price"
        case size, unit
        case pricePerUnit = "price_per_unit"
        case imageUrl = "image_url"
        case store, upc, asin
        case isPrime = "is_prime"
        case matchScore = "match_score"
        case aiReasoning = "ai_reasoning"
        case normalizedTotalQty = "normalized_total_qty"
        case normalizedQtyUnit = "normalized_qty_unit"
        case department, link
    }
}
