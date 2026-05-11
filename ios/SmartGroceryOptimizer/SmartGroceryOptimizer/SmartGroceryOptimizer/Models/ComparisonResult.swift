import Foundation

// MARK: - Comparison Result & Summary
// Mirrors: types/index.ts — ComparisonResult, ComparisonSummary

/// Per-unit price breakdown within a ComparisonResult
struct PricePerUnitInfo: Codable, Equatable {
    let kroger: Double?
    let amazon: Double?
    let unit: String
}

/// Price comparison result for a single list item
struct ComparisonResult: Codable, Equatable {
    let item: ListItem
    let kroger: [ProductMatch]
    let amazon: [ProductMatch]
    let selectedKroger: ProductMatch?
    let selectedAmazon: ProductMatch?
    let winner: Winner
    let savings: Double
    let ppuWinner: Winner?
    let savingsNote: String?
    let pricePerUnit: PricePerUnitInfo

    enum CodingKeys: String, CodingKey {
        case item, kroger, amazon
        case selectedKroger = "selected_kroger"
        case selectedAmazon = "selected_amazon"
        case winner, savings
        case ppuWinner = "ppu_winner"
        case savingsNote = "savings_note"
        case pricePerUnit = "price_per_unit"
    }
}

/// Dashboard-level stats from a comparison run
struct ComparisonSummary: Codable, Equatable {
    let totalItems: Int
    let krogerWins: Int
    let amazonWins: Int
    let ties: Int
    let totalSavings: Double
    let krogerCartTotal: Double
    let amazonCartTotal: Double
    let unmappedCount: Int
}
