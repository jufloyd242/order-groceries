import Foundation

// MARK: - API Response Envelopes
// All /api/* routes return { success: Bool, error?: String, ...data }

/// Generic API response wrapper for single-object payloads
struct APIResponse<T: Decodable>: Decodable {
    let success: Bool
    let error: String?

    /// The decoded payload — available only when `success == true`
    let data: T?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicCodingKey.self)
        success = try container.decode(Bool.self, forKey: .init("success"))
        error = try container.decodeIfPresent(String.self, forKey: .init("error"))

        // The payload key varies by endpoint — T decodes from the same container
        data = try? T(from: decoder)
    }
}

/// Helpers for dynamic JSON keys
struct DynamicCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int?

    init(_ string: String) {
        stringValue = string
        intValue = nil
    }

    init?(stringValue: String) {
        self.stringValue = stringValue
        self.intValue = nil
    }

    init?(intValue: Int) {
        self.intValue = intValue
        self.stringValue = String(intValue)
    }
}

// MARK: - Endpoint-specific response payloads

/// GET /api/list → { success, count, items }
struct ListResponse: Decodable {
    let count: Int?
    let items: [UIListItem]
}

/// POST /api/list → { success, added, skipped, items }
struct AddItemsResponse: Decodable {
    let added: Int
    let skipped: Int
    let items: [ListItem]
}

/// GET /api/compare → { success, results, summary }
struct CompareResponse: Decodable {
    let results: [ComparisonResult]
    let summary: ComparisonSummary
}

/// GET /api/search → { success, query, count, kroger_count, amazon_count, results }
struct SearchResponse: Decodable {
    let query: String
    let count: Int
    let krogerCount: Int?
    let amazonCount: Int?
    let results: [ProductMatch]

    enum CodingKeys: String, CodingKey {
        case query, count, results
        case krogerCount = "kroger_count"
        case amazonCount = "amazon_count"
    }
}

/// GET /api/settings → { success, settings }
struct SettingsResponse: Decodable {
    let settings: AppSettings
}

/// GET /api/preferences → { success, count, preferences }
struct PreferencesResponse: Decodable {
    let count: Int?
    let preferences: [ProductPreference]
}

/// GET /api/todoist/sync → { success, project_name, count, items }
struct TodoistSyncResponse: Decodable {
    let projectName: String?
    let count: Int
    let items: [TodoistSyncItem]

    enum CodingKeys: String, CodingKey {
        case projectName = "project_name"
        case count, items
    }
}

/// Individual Todoist sync item (simplified — only fields the iOS app needs)
struct TodoistSyncItem: Decodable {
    let rawText: String
    let todoistTaskId: String?
    let source: String

    enum CodingKeys: String, CodingKey {
        case rawText = "raw_text"
        case todoistTaskId = "todoist_task_id"
        case source
    }
}

/// GET /api/kroger/auth/status → { success, linked, ... }
struct KrogerAuthStatusResponse: Decodable {
    let linked: Bool
}
