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
                        cartBar
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
                ItemSearchView(item: item)
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
            // ── Bulk selection row ──
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

            if !viewModel.pendingItems.isEmpty {
                Section("To Buy (\(viewModel.pendingItems.count))") {
                    ForEach(viewModel.pendingItems) { item in
                        GroceryItemView(
                            item: item,
                            selected: viewModel.selectedIds.contains(item.id),
                            onToggle: { _ in viewModel.toggleSelection(item.id) },
                            onRemove: { id in Task { await viewModel.removeItem(id) } },
                            onSearch: { _ in searchItem = item }
                        )
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.surfaceContainerLowest)
                    }
                }
            }

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

    // MARK: - Cart bar (shown when items are selected)

    private var cartBar: some View {
        HStack(spacing: 12) {
            Image(systemName: "cart.badge.plus")
                .foregroundStyle(Color.onPrimary)
            Text("Add \(viewModel.selectedPendingCount) to King Soopers")
                .font(.subheadline.bold())
                .foregroundStyle(Color.onPrimary)
            Spacer()
            if viewModel.isSubmittingCart {
                ProgressView().tint(Color.onPrimary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.primary)
        .contentShape(Rectangle())
        .onTapGesture {
            Task { await viewModel.submitCart() }
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

