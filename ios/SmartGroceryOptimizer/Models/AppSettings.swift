import Foundation

// MARK: - App Settings
// Mirrors: types/index.ts — AppSettings

/// Application configuration stored in Supabase app_settings table
struct AppSettings: Codable, Equatable {
    let defaultZipCode: String
    let storeChain: String
    let todoistProjectName: String
    let krogerLocationId: String
    let krogerStoreName: String?
    let orderModality: OrderModality
    /// String "true"/"false" — matches the API contract
    let autoRemoveOnCart: String
    /// Comma-separated generic_names to always retain
    let retainedItems: String

    enum CodingKeys: String, CodingKey {
        case defaultZipCode = "default_zip_code"
        case storeChain = "store_chain"
        case todoistProjectName = "todoist_project_name"
        case krogerLocationId = "kroger_location_id"
        case krogerStoreName = "kroger_store_name"
        case orderModality = "order_modality"
        case autoRemoveOnCart = "auto_remove_on_cart"
        case retainedItems = "retained_items"
    }

    /// Convenience: `auto_remove_on_cart` as a Bool
    var shouldAutoRemoveOnCart: Bool {
        autoRemoveOnCart == "true"
    }
}
