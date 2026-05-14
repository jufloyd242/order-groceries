import Foundation
import Combine

// MARK: - GroceryListViewModel
// Fetches and manages the shopping list from GET /api/list.
// Mirrors the state managed by compare/page.tsx in the web app.

@MainActor
final class GroceryListViewModel: ObservableObject {
    @Published private(set) var items: [UIListItem] = []
    @Published private(set) var isLoading = false
    @Published private(set) var isSyncing = false
    @Published private(set) var isSubmittingCart = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    /// IDs of items the user has locally checked to go in the cart
    @Published var selectedIds: Set<String> = []

    // MARK: - Fetch

    func loadItems() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: ListResponse = try await APIClient.shared.get("/api/list")
            items = response.items
            // Remove stale selections for items no longer in the list
            selectedIds = selectedIds.filter { id in items.contains { $0.id == id } }
        } catch APIError.unauthenticated {
            errorMessage = "Session expired — please sign in again."
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
            errorMessage = "Session expired — please sign in again."
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

    // MARK: - Toggle Purchased (swipe or tap)

    func toggleItem(_ item: UIListItem) async {
        if item.status == .pending || item.status == .matched || item.status == .compared {
            await markPurchased(item.id)
        } else if item.status == .purchased {
            await markPending(item.id)
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

        isSubmittingCart = true
        defer { isSubmittingCart = false }

        struct SubmitBody: Encodable { let items: [CartItem] }
        struct SubmitResponse: Decodable { let success: Bool; let results: [StoreSubmitResult]? }

        let cartItems = toSubmit.compactMap { item -> CartItem? in
            guard let upc = item.preference?.preferredUpc else { return nil }
            return CartItem(
                id: "kroger-\(upc)",
                store: .kroger,
                name: item.preference?.displayName ?? item.rawText,
                brand: "",
                price: 0,
                quantity: Int(item.quantity ?? 1),
                imageUrl: item.preference?.imageUrl,
                size: item.unit ?? "",
                upc: upc,
                asin: nil,
                listItemId: item.id,
                addedAt: Date().timeIntervalSince1970 * 1000
            )
        }

        do {
            let result: SubmitResponse = try await APIClient.shared.post("/api/cart/submit", body: SubmitBody(items: cartItems))
            if result.success {
                successMessage = "Added \(cartItems.count) item(s) to your King Soopers cart."
                deselectAll()
            } else {
                let errs = result.results?.flatMap(\.errors).joined(separator: "\n") ?? "Unknown error"
                errorMessage = errs
            }
        } catch {
            errorMessage = "Cart submission failed: \(error.localizedDescription)"
        }
    }

    // MARK: - Computed

    var pendingItems: [UIListItem] {
        items.filter { $0.status != .purchased && $0.status != .carted }
    }

    var purchasedItems: [UIListItem] {
        items.filter { $0.status == .purchased || $0.status == .carted }
    }

    var selectedPendingCount: Int {
        pendingItems.filter { selectedIds.contains($0.id) }.count
    }

    var allPendingSelected: Bool {
        !pendingItems.isEmpty && pendingItems.allSatisfy { selectedIds.contains($0.id) }
    }
}
