import Foundation

// MARK: - Department Emoji Mapping
// Mirrors: components/ListItem.tsx — DEPT_EMOJI dictionary

enum DepartmentEmoji {
    private static let mapping: [String: String] = [
        "Produce": "🥦",
        "Bakery": "🍞",
        "Deli": "🧀",
        "Meat": "🥩",
        "Seafood": "🐟",
        "Dairy": "🥛",
        "Frozen": "🧊",
        "Beverages": "🥤",
        "Snacks": "🍿",
        "Pantry": "🥫",
        "Household": "🧹",
        "Personal Care": "🧴",
        "Pet Care": "🐾",
        "Other": "🛒",
    ]

    static func emoji(for department: String?) -> String {
        guard let dept = department else { return "🛒" }
        return mapping[dept] ?? "🛒"
    }
}
