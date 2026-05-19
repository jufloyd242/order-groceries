import Foundation
import Combine
import UIKit

// MARK: - GroceryListViewModel
// Fetches and manages the shopping list from GET /api/list.
// Mirrors the state managed by compare/page.tsx in the web app.

@MainActor
final class GroceryListViewModel: ObservableObject {
    @Published private(set) var items: [UIListItem] = []
    @Published private(set) var settings: AppSettings?
    @Published private(set) var isLoading = false
    @Published private(set) var isSyncing = false
    @Published private(set) var isSubmittingCart = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    /// Amazon handoff links — shown in AmazonHandoffView for user-assisted add-to-cart.
    /// Set after cart submission when Amazon items are included.
    @Published var pendingAmazonLinks: [AmazonHandoffLink] = []

    /// IDs of items the user has locally checked to go in the cart
    @Published var selectedIds: Set<String> = [] {
        didSet { persistSelection() }
    }

    private static let selectedIdsKey = "grocery_selected_ids"

    /// Tracks whether the initial default selection has been applied
    private var hasPerformedInitialSelection = false

    // MARK: - Selection Persistence

    private func persistSelection() {
        UserDefaults.standard.set(Array(selectedIds), forKey: Self.selectedIdsKey)
    }

    private func restoreSelection(validIds: Set<String>) -> Set<String>? {
        guard let saved = UserDefaults.standard.stringArray(forKey: Self.selectedIdsKey) else { return nil }
        // Intersect with currently valid item IDs to remove stale entries
        return validIds.intersection(saved)
    }

    // MARK: - Fetch

    func loadItems() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        // Load list + settings in parallel
        async let listFetch: ListResponse = APIClient.shared.get("/api/list")
        async let settingsFetch: SettingsResponse = APIClient.shared.get("/api/settings")

        do {
            let (response, settingsResp) = try await (listFetch, settingsFetch)
            settings = settingsResp.settings
            items = response.items
            let validIds = Set(items.map(\.id))
            if hasPerformedInitialSelection {
                // Reconcile: keep previously selected IDs that still exist in the list
                selectedIds = selectedIds.filter { validIds.contains($0) }
            } else {
                hasPerformedInitialSelection = true
                // Restore from UserDefaults — do NOT default to select-all on every launch
                if let restored = restoreSelection(validIds: validIds) {
                    selectedIds = restored
                } else {
                    // First-ever launch: pre-select all active items
                    selectedIds = Set(items.filter {
                        $0.status == .pending || $0.status == .matched || $0.status == .compared
                    }.map(\.id))
                }
            }
        } catch APIError.unauthenticated {
            // Token expired mid-session — navigate back to login
            AuthManager.shared.sessionExpired()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Add Item

    func addItem(rawText: String) async {
        let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        struct AddBody: Encodable {
            let items: [NewListItem]
        }

        do {
            let _: AddItemsResponse = try await APIClient.shared.post(
                "/api/list",
                body: AddBody(items: [NewListItem(rawText: trimmed)])
            )
            await loadItems()
        } catch {
            errorMessage = "Failed to add item: \(error.localizedDescription)"
        }
    }

    // MARK: - Todoist Sync

    func syncTodoist() async {
        isSyncing = true
        errorMessage = nil
        defer { isSyncing = false }

        struct TodoistItem: Decodable {
            let rawText: String
            let todoistTaskId: String?
            let source: String

            enum CodingKeys: String, CodingKey {
                case rawText = "raw_text"
                case todoistTaskId = "todoist_task_id"
                case source
            }
        }
        struct TodoistResponse: Decodable {
            let count: Int
            let items: [TodoistItem]
        }
        struct AddBody: Encodable {
            let items: [NewListItem]
        }

        do {
            let syncResult: TodoistResponse = try await APIClient.shared.get("/api/todoist/sync")
            guard syncResult.count > 0 else {
                successMessage = "Todoist list is empty."
                return
            }
            let newItems = syncResult.items.map { t in
                NewListItem(rawText: t.rawText, source: .todoist, todoistTaskId: t.todoistTaskId)
            }
            let _: AddItemsResponse = try await APIClient.shared.post("/api/list", body: AddBody(items: newItems))
            await loadItems()
            successMessage = "Synced \(syncResult.count) item(s) from Todoist."
        } catch APIError.unauthenticated {
            // Token expired — navigate back to login
            AuthManager.shared.sessionExpired()
        } catch {
            errorMessage = "Todoist sync failed: \(error.localizedDescription)"
        }
    }

    // MARK: - Selection

    func toggleSelection(_ id: String) {
        if selectedIds.contains(id) {
            selectedIds.remove(id)
        } else {
            selectedIds.insert(id)
        }
    }

    func selectAll() {
        selectedIds = Set(pendingItems.map(\.id))
    }

    func deselectAll() {
        selectedIds = []
    }

    /// Toggle selection for a specific section's items
    func toggleSelectSection(_ ids: [String], allSelected: Bool) {
        if allSelected {
            selectedIds.subtract(ids)
        } else {
            selectedIds.formUnion(ids)
        }
    }

    // MARK: - Toggle Purchased (swipe or tap)

    func toggleItem(_ item: UIListItem) async {
        if item.status == .pending || item.status == .matched || item.status == .compared {
            await markPurchased(item.id)
        } else if item.status == .purchased {
            await revertCartItem(item.id)
        }
    }

    private func markPurchased(_ id: String) async {
        struct EmptyResponse: Decodable { let success: Bool? }
        do {
            let _: EmptyResponse = try await APIClient.shared.patch("/api/list/\(id)/purchased")
            if let idx = items.firstIndex(where: { $0.id == id }) {
                items[idx] = items[idx].withStatus(.purchased)
            }
            selectedIds.remove(id)
        } catch {
            errorMessage = "Failed to update item: \(error.localizedDescription)"
        }
    }

    private func markPending(_ id: String) async {
        struct Body: Encodable { let listItemIds: [String] }
        struct EmptyResponse: Decodable { let success: Bool? }
        do {
            let _: EmptyResponse = try await APIClient.shared.post(
                "/api/list/revert-cart",
                body: Body(listItemIds: [id])
            )
            if let idx = items.firstIndex(where: { $0.id == id }) {
                items[idx] = items[idx].withStatus(.pending)
            }
        } catch {
            errorMessage = "Failed to update item: \(error.localizedDescription)"
        }
    }

    /// Move a carted item back to the active list (pending) and reopen its Todoist task.
    func revertCartItem(_ id: String) async {
        struct Body: Encodable { let listItemIds: [String] }
        struct EmptyResponse: Decodable { let success: Bool? }
        // Optimistic
        if let idx = items.firstIndex(where: { $0.id == id }) {
            items[idx] = items[idx].withStatus(.pending)
        }
        do {
            let _: EmptyResponse = try await APIClient.shared.post(
                "/api/list/revert-cart",
                body: Body(listItemIds: [id])
            )
        } catch {
            // Rollback
            if let idx = items.firstIndex(where: { $0.id == id }) {
                items[idx] = items[idx].withStatus(.carted)
            }
            errorMessage = "Failed to put item back: \(error.localizedDescription)"
        }
    }

    // MARK: - Toggle Persistent (pin/unpin staple)

    func togglePersistent(_ id: String) async {
        guard let item = items.first(where: { $0.id == id }) else { return }
        let newValue = !(item.persistent ?? false)
        // Optimistic
        if let idx = items.firstIndex(where: { $0.id == id }) {
            items[idx] = items[idx].withPersistent(newValue)
        }
        struct Body: Encodable { let id: String; let updates: Updates
            struct Updates: Encodable { let persistent: Bool }
        }
        struct Resp: Decodable { let success: Bool? }
        do {
            let _: Resp = try await APIClient.shared.patch("/api/list", body: Body(id: id, updates: .init(persistent: newValue)))
        } catch {
            // Roll back
            if let idx = items.firstIndex(where: { $0.id == id }) {
                items[idx] = items[idx].withPersistent(!newValue)
            }
            errorMessage = "Failed to pin/unpin item."
        }
    }

    // MARK: - Change Quantity

    func changeQuantity(_ id: String, quantity: Int) async {
        let qty = Double(max(1, quantity))
        // Optimistic
        if let idx = items.firstIndex(where: { $0.id == id }) {
            items[idx] = items[idx].withQuantity(qty)
        }
        struct Body: Encodable { let id: String; let updates: Updates
            struct Updates: Encodable { let quantity: Double }
        }
        struct Resp: Decodable { let success: Bool? }
        do {
            let _: Resp = try await APIClient.shared.patch("/api/list", body: Body(id: id, updates: .init(quantity: qty)))
        } catch {
            errorMessage = "Failed to update quantity."
            await loadItems()
        }
    }

    // MARK: - Remove Item

    func removeItem(_ id: String) async {
        struct Body: Encodable { let id: String }
        struct DeleteResponse: Decodable { let success: Bool?; let removed: Int? }
        do {
            let response: DeleteResponse = try await APIClient.shared.delete(
                "/api/list",
                body: Body(id: id)
            )
            // Optimistic: remove from local array immediately
            items.removeAll { $0.id == id }
            selectedIds.remove(id)
            // If the server says 0 rows were deleted, reload to stay in sync
            if response.removed == 0 {
                await loadItems()
            }
        } catch {
            errorMessage = "Failed to remove item: \(error.localizedDescription)"
        }
    }

    // MARK: - Add to Cart (single item)

    /// Move a single pending item to carted status via API PATCH.
    func addToCart(_ id: String) async {
        // Optimistic: update local status
        guard let idx = items.firstIndex(where: { $0.id == id }) else { return }
        let snapshot = items[idx]
        items[idx] = items[idx].withStatus(.carted)
        selectedIds.remove(id)

        struct Body: Encodable { let id: String; let updates: Updates
            struct Updates: Encodable { let status: String }
        }
        struct Resp: Decodable { let success: Bool? }

        do {
            let _: Resp = try await APIClient.shared.patch(
                "/api/list",
                body: Body(id: id, updates: .init(status: "carted"))
            )
        } catch {
            // Roll back
            items[idx] = snapshot
            errorMessage = "Failed to add item to cart."
        }
    }

    // MARK: - Clear Preference

    /// Remove the saved product preference for a list item, making it unmapped again.
    /// Preferences are keyed by generic_name (= normalized_text), not by a FK id.
    func clearPreference(_ id: String) async {
        guard let idx = items.firstIndex(where: { $0.id == id }) else { return }
        let snapshot = items[idx]

        // Preferences have no mapping — bail if there's nothing to clear
        guard snapshot.preference != nil else { return }

        // Optimistic: clear local preference immediately
        items[idx] = UIListItem(
            id: snapshot.id,
            rawText: snapshot.rawText,
            normalizedText: snapshot.normalizedText,
            quantity: snapshot.quantity,
            unit: snapshot.unit,
            quantityType: snapshot.quantityType,
            minRequiredAmount: snapshot.minRequiredAmount,
            minRequiredUnit: snapshot.minRequiredUnit,
            source: snapshot.source,
            todoistTaskId: snapshot.todoistTaskId,
            preferenceId: nil,
            status: snapshot.status,
            createdAt: snapshot.createdAt,
            purchasedAt: snapshot.purchasedAt,
            persistent: snapshot.persistent,
            department: snapshot.department,
            preference: nil
        )

        // Delete by generic_name (= normalized_text) — preferences have no direct FK on list_items
        let genericName = snapshot.normalizedText ?? snapshot.rawText
        struct Body: Encodable { let generic_name: String }
        struct Resp: Decodable { let success: Bool? }

        do {
            let _: Resp = try await APIClient.shared.delete(
                "/api/preferences",
                body: Body(generic_name: genericName)
            )
        } catch {
            // Roll back
            items[idx] = snapshot
            errorMessage = "Failed to clear preference."
        }
    }

    // MARK: - Delete Purchased

    /// Delete all items in the "purchased" / "carted" section.
    func deletePurchased() async {
        let ids = purchasedItems.map(\.id)
        guard !ids.isEmpty else { return }

        struct Body: Encodable { let ids: [String] }
        struct DeleteResponse: Decodable { let success: Bool?; let removed: Int? }

        // Optimistic: remove immediately
        let snapshot = items
        items.removeAll { ids.contains($0.id) }

        do {
            let _: DeleteResponse = try await APIClient.shared.delete(
                "/api/list",
                body: Body(ids: ids)
            )
        } catch {
            // Rollback on error
            items = snapshot
            errorMessage = "Failed to clear purchased items: \(error.localizedDescription)"
        }
    }

    // MARK: - Cart Submit

    /// Submit selected items that have a known UPC to the Kroger cart.
    func submitCart() async {
        let toSubmit = items.filter { selectedIds.contains($0.id) && $0.preference?.preferredUpc != nil }

        guard !toSubmit.isEmpty else {
            errorMessage = "No selected items have a product mapped. Tap an item to search for it first."
            return
        }

        await performCartSubmit(toSubmit)
    }

    /// Submit a specific set of item IDs — used by CartView's per-row selection.
    /// `quantityOverrides` are local-only overrides from the CartView stepper.
    func submitCartSelection(_ ids: Set<String>, quantityOverrides: [String: Int] = [:]) async {
        // Include both Kroger (UPC) and Amazon (ASIN) items
        let toSubmit = items.filter {
            ids.contains($0.id) &&
            ($0.preference?.preferredUpc != nil || $0.preference?.preferredAsin != nil)
        }

        guard !toSubmit.isEmpty else {
            errorMessage = "No selected items have a product mapped."
            return
        }

        await performCartSubmit(toSubmit, quantityOverrides: quantityOverrides)
    }

    private func performCartSubmit(_ toSubmit: [UIListItem], quantityOverrides: [String: Int] = [:]) async {
        isSubmittingCart = true
        defer { isSubmittingCart = false }

        struct SubmitBody: Encodable { let items: [CartItem] }
        struct SubmitResponse: Decodable {
            let success: Bool
            let results: [StoreSubmitResult]?
            let amazonLinks: [AmazonHandoffLink]?
        }

        let cartItems: [CartItem] = toSubmit.compactMap { item in
            let qty = quantityOverrides[item.id] ?? Int(item.quantity ?? 1)
            let pref = item.preference

            if let upc = pref?.preferredUpc {
                // Kroger item — submitted via cart API (auto-cart)
                return CartItem(
                    id: "kroger-\(upc)",
                    store: .kroger,
                    name: pref?.displayName ?? item.rawText,
                    brand: "",
                    price: 0,
                    quantity: qty,
                    imageUrl: pref?.imageUrl,
                    size: item.unit ?? "",
                    upc: upc,
                    asin: nil,
                    listItemId: item.id,
                    addedAt: Date().timeIntervalSince1970 * 1000
                )
            } else if let asin = pref?.preferredAsin {
                // Amazon item — server returns handoff links, not auto-added
                return CartItem(
                    id: "amazon-\(asin)",
                    store: .amazon,
                    name: pref?.displayName ?? item.rawText,
                    brand: "",
                    price: 0,
                    quantity: qty,
                    imageUrl: pref?.imageUrl,
                    size: item.unit ?? "",
                    upc: nil,
                    asin: asin,
                    listItemId: item.id,
                    addedAt: Date().timeIntervalSince1970 * 1000
                )
            }
            return nil
        }

        do {
            let result: SubmitResponse = try await APIClient.shared.post("/api/cart/submit", body: SubmitBody(items: cartItems))

            let krogerResult = result.results?.first { $0.store == .kroger }

            let krogerSucceeded = krogerResult?.success == true
            let krogerCount = krogerResult?.itemsAdded ?? 0
            let hasKrogerItems = cartItems.contains { $0.store == .kroger }
            let hasAmazonItems = cartItems.contains { $0.store == .amazon }

            // Kroger succeeded (or no Kroger items) → cleanup Kroger items only
            if krogerSucceeded || !hasKrogerItems {
                // Only cleanup Kroger items immediately — Amazon items stay until
                // user confirms via the handoff view
                let krogerListItemIds = toSubmit
                    .filter { $0.preference?.preferredUpc != nil }
                    .map(\.id)

                if !krogerListItemIds.isEmpty {
                    struct CleanupBody: Encodable { let listItemIds: [String] }
                    struct CleanupResponse: Decodable { let success: Bool?; let staplesRestored: Int? }
                    let _: CleanupResponse = try await APIClient.shared.post(
                        "/api/list/cleanup-on-cart",
                        body: CleanupBody(listItemIds: krogerListItemIds)
                    )
                }

                // Build success message
                var parts: [String] = []
                if krogerCount > 0 {
                    parts.append("Added \(krogerCount) item(s) to your King Soopers cart.")
                }

                // Amazon items: queue handoff links for user-assisted add-to-cart
                if hasAmazonItems, let links = result.amazonLinks, !links.isEmpty {
                    parts.append("\(links.count) Amazon item(s) ready — tap to open each.")
                    pendingAmazonLinks = links
                } else if hasAmazonItems {
                    parts.append("Amazon items: add manually on amazon.com.")
                }

                successMessage = parts.isEmpty
                    ? "\(cartItems.count) item(s) submitted."
                    : parts.joined(separator: " ")
                deselectAll()
                await loadItems()
            } else {
                // Kroger failed — surface the error
                var msgs: [String] = []
                if let krogerErrs = krogerResult?.errors, !krogerErrs.isEmpty {
                    msgs.append(contentsOf: krogerErrs)
                }
                errorMessage = msgs.joined(separator: "\n")
            }
        } catch {
            errorMessage = "Cart submission failed: \(error.localizedDescription)"
        }
    }

    // MARK: - Amazon Handoff Confirmation

    /// Called when user dismisses the AmazonHandoffView with confirmed items.
    /// Runs cleanup (mark purchased, close Todoist tasks) only for confirmed listItemIds.
    func confirmAmazonHandoff(_ confirmedListItemIds: [String]) async {
        guard !confirmedListItemIds.isEmpty else { return }
        struct CleanupBody: Encodable { let listItemIds: [String] }
        struct CleanupResponse: Decodable { let success: Bool?; let staplesRestored: Int? }
        do {
            let _: CleanupResponse = try await APIClient.shared.post(
                "/api/list/cleanup-on-cart",
                body: CleanupBody(listItemIds: confirmedListItemIds)
            )
            await loadItems()
        } catch {
            print("[AmazonHandoff] Cleanup failed: \(error.localizedDescription)")
        }
        pendingAmazonLinks = []
    }

    /// Dismiss the Amazon handoff without confirming any items
    func dismissAmazonHandoff() {
        pendingAmazonLinks = []
    }

    // MARK: - Delete Selected (batch)

    func deleteSelected() async {
        let ids = Array(selectedIds)
        guard !ids.isEmpty else { return }

        struct Body: Encodable { let ids: [String] }
        struct DeleteResponse: Decodable { let success: Bool?; let removed: Int? }

        // Optimistic: remove immediately
        let snapshot = items
        let selectedSnapshot = selectedIds
        items.removeAll { ids.contains($0.id) }
        selectedIds = []

        do {
            let _: DeleteResponse = try await APIClient.shared.delete(
                "/api/list",
                body: Body(ids: ids)
            )
        } catch {
            // Rollback on error
            items = snapshot
            selectedIds = selectedSnapshot
            errorMessage = "Failed to delete items: \(error.localizedDescription)"
        }
    }

    // MARK: - Computed

    var pendingItems: [UIListItem] {
        items.filter { $0.status != .purchased && $0.status != .carted }
    }

    /// Pinned staples — persistent items that are still pending
    var stapleItems: [UIListItem] {
        items.filter { $0.persistent == true && $0.status != .purchased && $0.status != .carted }
    }

    /// Today's list — non-persistent pending items
    var todayItems: [UIListItem] {
        items.filter { $0.persistent != true && $0.status != .purchased && $0.status != .carted }
    }

    var purchasedItems: [UIListItem] {
        items.filter { $0.status == .purchased || $0.status == .carted }
    }

    /// Items actively in the cart (submitted to store, not yet purchased)
    var cartedItems: [UIListItem] {
        items.filter { $0.status == .carted }
    }

    /// Display name for the preferred cart store (e.g. "King Soopers")
    var storeName: String {
        settings?.storeChain ?? settings?.krogerStoreName ?? "King Soopers"
    }

    var selectedPendingCount: Int {
        pendingItems.filter { selectedIds.contains($0.id) }.count
    }

    /// Number of selected pending items that have a mapped product (UPC or ASIN) — these can be carted.
    var selectedMappedCount: Int {
        pendingItems.filter {
            selectedIds.contains($0.id) &&
            ($0.preference?.preferredUpc != nil || $0.preference?.preferredAsin != nil)
        }.count
    }

    /// Number of selected pending items with NO product mapping — these need search first.
    var selectedUnmappedCount: Int { selectedPendingCount - selectedMappedCount }

    var allPendingSelected: Bool {
        !pendingItems.isEmpty && pendingItems.allSatisfy { selectedIds.contains($0.id) }
    }

    // MARK: - Per-Section Selection Helpers

    var stapleSelectableIds: [String] {
        stapleItems.filter { $0.status != .carted && $0.status != .purchased }.map(\.id)
    }

    var stapleAllSelected: Bool {
        !stapleSelectableIds.isEmpty && stapleSelectableIds.allSatisfy { selectedIds.contains($0) }
    }

    var todaySelectableIds: [String] {
        todayItems.filter { $0.status != .carted && $0.status != .purchased }.map(\.id)
    }

    var todayAllSelected: Bool {
        !todaySelectableIds.isEmpty && todaySelectableIds.allSatisfy { selectedIds.contains($0) }
    }

    /// First selected, unmapped pending item — kept for legacy compatibility
    var firstUnmappedSelectedItem: UIListItem? {
        pendingItems.first {
            selectedIds.contains($0.id) &&
            $0.preference?.preferredUpc == nil &&
            $0.preference?.preferredAsin == nil
        }
    }

    /// First selected pending item regardless of mapping state — used by search-first batch bar.
    var firstSelectedPendingItem: UIListItem? {
        pendingItems.first { selectedIds.contains($0.id) }
    }
}
