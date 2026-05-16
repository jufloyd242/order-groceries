import SwiftUI

// MARK: - GroceryListView
// Main screen after login. Shows the shopping list with pending and purchased sections.
// Mirrors the layout/behaviour of /app/compare/page.tsx in the web app.

struct GroceryListView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var viewModel = GroceryListViewModel()
    @State private var newItemText = ""
    @State private var showAddField = false
    @FocusState private var addFieldFocused: Bool
    @State private var showSettings = false
    @State private var showCart = false
    @State private var showDeleteConfirm = false
    @State private var searchItem: UIListItem?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.items.isEmpty {
                    ProgressView("Loading list…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.items.isEmpty {
                    emptyState
                } else {
                    itemList
                }
            }
            .navigationTitle("Grocery List")
            .navigationBarTitleDisplayMode(.large)
            .toolbar { toolbarContent }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 0) {
                    if viewModel.selectedPendingCount > 0 {
                        batchActionBar
                    }
                    if showAddField {
                        addBar
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .sheet(item: $searchItem) { item in
                ItemSearchView(item: item, onSaved: {
                    Task { await viewModel.loadItems() }
                })
            }
            .sheet(isPresented: $showCart) {
                CartView(viewModel: viewModel)
            }
            .alert("Error", isPresented: Binding(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
            .alert("Done", isPresented: Binding(
                get: { viewModel.successMessage != nil },
                set: { if !$0 { viewModel.successMessage = nil } }
            )) {
                Button("OK") { viewModel.successMessage = nil }
            } message: {
                Text(viewModel.successMessage ?? "")
            }
        }
        .task { await viewModel.loadItems() }
    }

    // MARK: - List

    private var itemList: some View {
        List {
            // ── Global bulk selection row ──
            if !viewModel.pendingItems.isEmpty {
                HStack {
                    Button(viewModel.allPendingSelected ? "Deselect All" : "Select All") {
                        viewModel.allPendingSelected ? viewModel.deselectAll() : viewModel.selectAll()
                    }
                    .font(.subheadline)
                    Spacer()
                    if viewModel.selectedPendingCount > 0 {
                        Text("\(viewModel.selectedPendingCount) selected")
                            .font(.caption)
                            .foregroundStyle(Color.onSurfaceVariant)
                    }
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            // ── Staples section (persistent items) ──
            if !viewModel.stapleItems.isEmpty {
                Section {
                    ForEach(viewModel.stapleItems) { item in
                        GroceryItemView(
                            item: item,
                            selected: viewModel.selectedIds.contains(item.id),
                            onToggle: { _ in viewModel.toggleSelection(item.id) },
                            onRemove: { id in Task { await viewModel.removeItem(id) } },
                            onTogglePersistent: { id in Task { await viewModel.togglePersistent(id) } },
                            onQuantityChange: { id, qty in Task { await viewModel.changeQuantity(id, quantity: qty) } },
                            onSearch: { _ in searchItem = item }
                        )
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.surfaceContainerLowest)
                    }
                } header: {
                    HStack {
                        Text("Staples (\(viewModel.stapleItems.count))")
                        Spacer()
                        Button(viewModel.stapleAllSelected ? "Deselect" : "Select All") {
                            viewModel.toggleSelectSection(viewModel.stapleSelectableIds, allSelected: viewModel.stapleAllSelected)
                        }
                        .font(.system(size: 12, weight: .medium))
                    }
                }
            }

            // ── Today's List section (non-persistent pending items) ──
            if !viewModel.todayItems.isEmpty {
                Section {
                    ForEach(viewModel.todayItems) { item in
                        GroceryItemView(
                            item: item,
                            selected: viewModel.selectedIds.contains(item.id),
                            onToggle: { _ in viewModel.toggleSelection(item.id) },
                            onRemove: { id in Task { await viewModel.removeItem(id) } },
                            onTogglePersistent: { id in Task { await viewModel.togglePersistent(id) } },
                            onQuantityChange: { id, qty in Task { await viewModel.changeQuantity(id, quantity: qty) } },
                            onSearch: { _ in searchItem = item }
                        )
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.surfaceContainerLowest)
                    }
                } header: {
                    HStack {
                        Text("Today's List (\(viewModel.todayItems.count))")
                        Spacer()
                        Button(viewModel.todayAllSelected ? "Deselect" : "Select All") {
                            viewModel.toggleSelectSection(viewModel.todaySelectableIds, allSelected: viewModel.todayAllSelected)
                        }
                        .font(.system(size: 12, weight: .medium))
                    }
                }
            }

            // ── In Cart / Purchased section ──
            if !viewModel.purchasedItems.isEmpty {
                Section {
                    ForEach(viewModel.purchasedItems) { item in
                        GroceryItemView(
                            item: item,
                            selected: true,
                            onToggle: { _ in Task { await viewModel.toggleItem(item) } },
                            onRemove: { id in Task { await viewModel.removeItem(id) } },
                            onSearch: { _ in searchItem = item }
                        )
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.surfaceContainerLowest)
                    }
                } header: {
                    HStack {
                        Text("In Cart / Purchased (\(viewModel.purchasedItems.count))")
                        Spacer()
                        Button(role: .destructive) {
                            Task { await viewModel.deletePurchased() }
                        } label: {
                            Label("Clear", systemImage: "trash")
                                .font(.system(size: 12, weight: .medium))
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await viewModel.loadItems() }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "cart")
                .font(.system(size: 48))
                .foregroundStyle(Color.outline)
            Text("Your list is empty")
                .font(.title3.bold())
                .foregroundStyle(Color.onSurface)
            Text("Tap + to add an item or sync from Todoist")
                .font(.subheadline)
                .foregroundStyle(Color.onSurfaceVariant)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .refreshable { await viewModel.loadItems() }
    }

    // MARK: - Dynamic Batch Action Bar
    // Shows "Search & Compare" as primary when any selected item is unmapped.
    // Shows "Add to [Store]" as primary only when all selected items are mapped.

    private var batchActionBar: some View {
        VStack(spacing: 0) {
            // Unmapped warning strip
            if viewModel.selectedUnmappedCount > 0 && viewModel.selectedMappedCount > 0 {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Color.yellow)
                        .font(.system(size: 11))
                    Text("\(viewModel.selectedUnmappedCount) item\(viewModel.selectedUnmappedCount == 1 ? "" : "s") still need search")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.onSurface)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.yellow.opacity(0.12))
            }

            HStack(spacing: 0) {
                // —— PRIMARY: Search & Compare — visible when any unmapped item is selected
                if viewModel.selectedUnmappedCount > 0 {
                    Button {
                        // Open search for the first unmapped selected item
                        if let item = viewModel.firstUnmappedSelectedItem {
                            searchItem = item
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "magnifyingglass")
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Search & Compare")
                                    .font(.subheadline.bold())
                                Text("\(viewModel.selectedUnmappedCount) item\(viewModel.selectedUnmappedCount == 1 ? "" : "s") need a product")
                                    .font(.caption)
                                    .opacity(0.8)
                            }
                            Spacer()
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 13)
                        .frame(maxWidth: .infinity)
                        .background(Color.secondary)
                        .foregroundStyle(Color.white)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }

                // —— CART: Add to [Store] — always shown, disabled unless mapped items selected
                Button {
                    guard viewModel.selectedMappedCount > 0 else { return }
                    Task { await viewModel.submitCart() }
                } label: {
                    HStack(spacing: 8) {
                        if viewModel.isSubmittingCart {
                            ProgressView().tint(Color.onPrimary)
                        } else {
                            Image(systemName: "cart.badge.plus")
                        }
                        VStack(alignment: .leading, spacing: 1) {
                            Text(viewModel.selectedMappedCount > 0
                                ? "Add \(viewModel.selectedMappedCount) to \(viewModel.storeName)"
                                : "Map items to add to cart")
                                .font(.subheadline.bold())
                            if viewModel.selectedUnmappedCount == 0 && viewModel.selectedMappedCount > 0 {
                                Text("All selected items mapped")
                                    .font(.caption)
                                    .opacity(0.8)
                            }
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 13)
                    .frame(maxWidth: .infinity)
                    .background(viewModel.selectedMappedCount > 0 ? Color.primary : Color.primary.opacity(0.45))
                    .foregroundStyle(Color.onPrimary)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(viewModel.selectedMappedCount == 0 || viewModel.isSubmittingCart)

                // —— DELETE: Trash selected items
                Button {
                    showDeleteConfirm = true
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Color.white)
                        .frame(width: 48, height: 48)
                        .background(Color.red.opacity(0.85))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .confirmationDialog(
            "Delete \(viewModel.selectedPendingCount) selected item\(viewModel.selectedPendingCount == 1 ? "" : "s")?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteSelected() }
            }
            Button("Cancel", role: .cancel) { }
        }
    }

    // MARK: - Add bar

    private var addBar: some View {
        HStack(spacing: 8) {
            TextField("Add item…", text: $newItemText)
                .textFieldStyle(.roundedBorder)
                .focused($addFieldFocused)
                .submitLabel(.done)
                .onSubmit { submitNewItem() }

            Button("Add") { submitNewItem() }
                .buttonStyle(.borderedProminent)
                .disabled(newItemText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }

    private func submitNewItem() {
        let text = newItemText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        Task { await viewModel.addItem(rawText: text) }
        newItemText = ""
        showAddField = false
        addFieldFocused = false
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarLeading) {
            Button {
                showSettings = true
            } label: {
                Image(systemName: "gear")
            }
        }
        ToolbarItemGroup(placement: .navigationBarTrailing) {
            // Cart button with badge showing carted item count
            Button {
                showCart = true
            } label: {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "cart")
                    if viewModel.cartedItems.count > 0 {
                        Text("\(viewModel.cartedItems.count)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color.white)
                            .padding(3)
                            .background(Color.red)
                            .clipShape(Circle())
                            .offset(x: 8, y: -8)
                    }
                }
            }
            .help("View cart")

            // Todoist sync
            Button {
                Task { await viewModel.syncTodoist() }
            } label: {
                if viewModel.isSyncing {
                    ProgressView().scaleEffect(0.8)
                } else {
                    Image(systemName: "arrow.triangle.2.circlepath")
                }
            }
            .disabled(viewModel.isSyncing)
            .help("Sync from Todoist")

            // Add item
            Button {
                showAddField.toggle()
                if showAddField { addFieldFocused = true }
            } label: {
                Image(systemName: showAddField ? "xmark.circle.fill" : "plus")
            }
        }
    }
}

#Preview {
    GroceryListView()
        .environmentObject(AuthManager.shared)
}

