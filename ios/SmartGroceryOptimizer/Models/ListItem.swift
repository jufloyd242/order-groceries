import Foundation

// MARK: - List Items
// Mirrors: types/index.ts — ListItem, UIListItem, UIListItemPreference, NewListItem

/// A shopping list entry from the database
struct ListItem: Codable, Identifiable, Equatable {
    let id: String
    let rawText: String
    let normalizedText: String?
    let quantity: Double?
    let unit: String?
    let source: ItemSource
    let todoistTaskId: String?
    let preferenceId: String?
    let status: ItemStatus
    let createdAt: Date
    let purchasedAt: Date?
    let persistent: Bool?
    let department: String?

    enum CodingKeys: String, CodingKey {
        case id
        case rawText = "raw_text"
        case normalizedText = "normalized_text"
        case quantity, unit, source
        case todoistTaskId = "todoist_task_id"
        case preferenceId = "preference_id"
        case status
        case createdAt = "created_at"
        case purchasedAt = "purchased_at"
        case persistent, department
    }
}

/// Preference data joined onto a list item by the API
struct UIListItemPreference: Codable, Equatable {
    let displayName: String
    let preferredUpc: String?
    let preferredAsin: String?
    let imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case displayName = "display_name"
        case preferredUpc = "preferred_upc"
        case preferredAsin = "preferred_asin"
        case imageUrl = "image_url"
    }
}

/// List item enriched with preference data (what GET /api/list returns)
struct UIListItem: Codable, Identifiable, Equatable {
    let id: String
    let rawText: String
    let normalizedText: String?
    let quantity: Double?
    let unit: String?
    let source: ItemSource
    let todoistTaskId: String?
    let preferenceId: String?
    let status: ItemStatus
    let createdAt: Date
    let purchasedAt: Date?
    let persistent: Bool?
    let department: String?
    let preference: UIListItemPreference?

    enum CodingKeys: String, CodingKey {
        case id
        case rawText = "raw_text"
        case normalizedText = "normalized_text"
        case quantity, unit, source
        case todoistTaskId = "todoist_task_id"
        case preferenceId = "preference_id"
        case status
        case createdAt = "created_at"
        case purchasedAt = "purchased_at"
        case persistent, department, preference
    }
}

/// POST body for adding items to the list
struct NewListItem: Codable {
    let rawText: String
    var source: ItemSource? = .manual
    var todoistTaskId: String?
    var persistent: Bool?

    enum CodingKeys: String, CodingKey {
        case rawText = "raw_text"
        case source
        case todoistTaskId = "todoist_task_id"
        case persistent
    }
}
