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
    /// "count" = discrete items (3 apples), "measurement" = recipe amount (1/2 cup milk)
    let quantityType: String?
    /// For measurements: minimum amount needed in base units (oz for weight, fl oz for volume)
    let minRequiredAmount: Double?
    /// Base unit for minRequiredAmount: "oz" or "fl oz"
    let minRequiredUnit: String?
    let source: ItemSource
    let todoistTaskId: String?
    let preferenceId: String?
    let status: ItemStatus
    let createdAt: Date
    let purchasedAt: Date?
    let persistent: Bool?
    let department: String?
    let preference: UIListItemPreference?

    var isMeasurement: Bool { quantityType == "measurement" }

    enum CodingKeys: String, CodingKey {
        case id
        case rawText = "raw_text"
        case normalizedText = "normalized_text"
        case quantity, unit
        case quantityType = "quantity_type"
        case minRequiredAmount = "min_required_amount"
        case minRequiredUnit = "min_required_unit"
        case source
        case todoistTaskId = "todoist_task_id"
        case preferenceId = "preference_id"
        case status
        case createdAt = "created_at"
        case purchasedAt = "purchased_at"
        case persistent, department, preference
    }

    /// Human-readable measurement requirement, e.g. "Need: 1/2 cup"
    var measurementLabel: String? {
        guard isMeasurement, let qty = quantity, let u = unit else { return nil }
        // Format nicely: show fraction for common values
        let qtyStr: String
        if qty == 0.5 { qtyStr = "1/2" }
        else if qty == 0.25 { qtyStr = "1/4" }
        else if qty == 0.75 { qtyStr = "3/4" }
        else if qty == 0.3333 || qty == 1.0/3.0 { qtyStr = "1/3" }
        else if qty.truncatingRemainder(dividingBy: 1) == 0 { qtyStr = String(Int(qty)) }
        else { qtyStr = String(format: "%.1f", qty) }
        return "Need: \(qtyStr) \(u)"
    }

    /// Return a copy of this item with a different status (for optimistic UI updates).
    func withStatus(_ newStatus: ItemStatus) -> UIListItem {
        UIListItem(
            id: id, rawText: rawText, normalizedText: normalizedText,
            quantity: quantity, unit: unit,
            quantityType: quantityType, minRequiredAmount: minRequiredAmount,
            minRequiredUnit: minRequiredUnit,
            source: source,
            todoistTaskId: todoistTaskId, preferenceId: preferenceId,
            status: newStatus, createdAt: createdAt, purchasedAt: purchasedAt,
            persistent: persistent, department: department, preference: preference
        )
    }

    /// Return a copy with updated persistent flag.
    func withPersistent(_ value: Bool) -> UIListItem {
        UIListItem(
            id: id, rawText: rawText, normalizedText: normalizedText,
            quantity: quantity, unit: unit,
            quantityType: quantityType, minRequiredAmount: minRequiredAmount,
            minRequiredUnit: minRequiredUnit,
            source: source,
            todoistTaskId: todoistTaskId, preferenceId: preferenceId,
            status: status, createdAt: createdAt, purchasedAt: purchasedAt,
            persistent: value, department: department, preference: preference
        )
    }

    /// Return a copy with updated quantity.
    func withQuantity(_ qty: Double) -> UIListItem {
        UIListItem(
            id: id, rawText: rawText, normalizedText: normalizedText,
            quantity: qty, unit: unit,
            quantityType: quantityType, minRequiredAmount: minRequiredAmount,
            minRequiredUnit: minRequiredUnit,
            source: source,
            todoistTaskId: todoistTaskId, preferenceId: preferenceId,
            status: status, createdAt: createdAt, purchasedAt: purchasedAt,
            persistent: persistent, department: department, preference: preference
        )
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
