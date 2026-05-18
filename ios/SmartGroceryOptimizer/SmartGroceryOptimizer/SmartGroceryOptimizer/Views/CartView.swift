import SwiftUI

// MARK: - CartView
// Interactive cart sheet. Mirrors the CartDrawer in the web app.
// Features: per-row selection checkboxes, inline quantity steppers,
//           swipe-to-revert ("Put Back") and swipe-to-delete ("Delete").

struct CartView: View {
    @ObservedObject var viewModel: GroceryListViewModel
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.dismiss) private var dismiss

    /// Called when the user taps "Link Account" in the Kroger-required alert.
    /// The parent should use this to open SettingsView after this sheet dismisses.
    var onLinkKroger: () -> Void = {}

    /// Per-row selection — controls which items are included in the submission.
    /// Defaults to all carted items (select-all on appear).
    @State private var selectedCartIds: Set<String> = []

    /// Local-only quantity overrides — NOT persisted to DB.
    /// Only used at submission time. Resets when cart sheet is dismissed.
    @State private var localQuantities: [String: Int] = [:]

    /// Shows the "link KS account" alert when submitting without a linked account
    @State private var showLinkAlert = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.cartedItems.isEmpty {
                    emptyState
                } else {
                    cartList
                }
            }
            .navigationTitle("Cart")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    // Select / deselect all toggle
                    if !viewModel.cartedItems.isEmpty {
                        Button(selectedCartIds.count == viewModel.cartedItems.count ? "Deselect All" : "Select All") {
                            if selectedCartIds.count == viewModel.cartedItems.count {
                                selectedCartIds = []
                            } else {
                                selectedCartIds = Set(viewModel.cartedItems.map(\.id))
                            }
                        }
                        .font(.subheadline)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("Error", isPresented: Binding(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
            .onAppear { syncSelection() }
            .onChange(of: viewModel.cartedItems) { _, _ in syncSelection() }
            .alert("King Soopers Account Required", isPresented: $showLinkAlert) {
                Button("Link Account") {
                    onLinkKroger()
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Link your King Soopers account in Settings to submit items to your cart.")
            }
        }
    }

    // MARK: - Sync selection

    /// Keep selectedCartIds in sync as cartedItems changes.
    /// New mapped arrivals are selected by default; unmapped items are excluded.
    private func syncSelection() {
        let mappedCartedIds = Set(viewModel.cartedItems.filter {
            $0.preference?.preferredUpc != nil || $0.preference?.preferredAsin != nil
        }.map(\.id))
        // Remove stale IDs, auto-select new mapped arrivals
        selectedCartIds = selectedCartIds.intersection(mappedCartedIds).union(mappedCartedIds)
    }

    // MARK: - Cart list

    private var cartList: some View {
        List {
            Section {
                ForEach(viewModel.cartedItems) { item in
                    cartRow(item)
                        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 16))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.surfaceContainerLowest)
                        // ── Put Back (leading swipe) ──
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            Button {
                                Task { await viewModel.revertCartItem(item.id) }
                            } label: {
                                Label("Put Back", systemImage: "arrow.uturn.left")
                            }
                            .tint(.blue)
                        }
                        // ── Delete permanently (trailing swipe) ──
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                Task { await viewModel.removeItem(item.id) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                }
            } header: {
                HStack {
                    Text("\(viewModel.cartedItems.count) item\(viewModel.cartedItems.count == 1 ? "" : "s") ready to submit")
                    Spacer()
                    if selectedCartIds.count < viewModel.cartedItems.count {
                        Text("\(selectedCartIds.count) of \(viewModel.cartedItems.count) selected")
                            .foregroundStyle(Color.outline)
                    }
                }
                .font(.caption)
                .foregroundStyle(Color.outline)
            }
        }
        .listStyle(.insetGrouped)
        .safeAreaInset(edge: .bottom) {
            submitBar
        }
    }

    // MARK: - Cart row

    @ViewBuilder
    private func cartRow(_ item: UIListItem) -> some View {
        let isSelected = selectedCartIds.contains(item.id)
        let qty = localQuantities[item.id] ?? Int(item.quantity ?? 1)
        let hasUpc = item.preference?.preferredUpc != nil
        let hasAsin = item.preference?.preferredAsin != nil
        let hasMapping = hasUpc || hasAsin
        let storeLabel = hasUpc ? "King Soopers" : (hasAsin ? "Amazon" : viewModel.storeName)
        let storeColor: Color = hasUpc ? .kroger : .amazon

        HStack(spacing: 12) {

            // ── Selection checkbox (disabled for unmapped reminder items) ──
            if hasMapping {
                Button {
                    if isSelected { selectedCartIds.remove(item.id) }
                    else { selectedCartIds.insert(item.id) }
                } label: {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 22))
                        .foregroundStyle(isSelected ? Color.primary : Color.outlineVariant)
                }
                .buttonStyle(.plain)
                .padding(.leading, 16)
            } else {
                // Unmapped: no checkbox, show info icon
                Image(systemName: "info.circle")
                    .font(.system(size: 22))
                    .foregroundStyle(Color.outlineVariant)
                    .padding(.leading, 16)
            }

            // ── Thumbnail ──
            Group {
                if let url = item.preference?.imageUrl, let imageURL = URL(string: url) {
                    AsyncImage(url: imageURL) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        default:
                            emojiView(item)
                        }
                    }
                } else {
                    emojiView(item)
                }
            }
            .frame(width: 48, height: 48)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.surfaceContainer, lineWidth: 1))

            // ── Product info ──
            VStack(alignment: .leading, spacing: 3) {
                Text(item.preference?.displayName ?? item.normalizedText ?? item.rawText)
                    .font(.subheadline.bold())
                    .foregroundStyle(Color.onSurface)
                    .lineLimit(2)

                // Store badge or reminder label
                if hasMapping {
                    Text(storeLabel)
                        .font(.badge)
                        .foregroundStyle(storeColor)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(storeColor.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                } else {
                    Text("Manual reminder — search to enable checkout")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.outline)
                }
            }

            Spacer(minLength: 4)

            // ── Inline quantity stepper (local-only — not persisted to DB) ──
            HStack(spacing: 0) {
                Button {
                    localQuantities[item.id] = max(1, qty - 1)
                } label: {
                    Image(systemName: "minus")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(qty <= 1 ? Color.outlineVariant : Color.outline)
                        .frame(width: 28, height: 28)
                }
                .disabled(qty <= 1)
                .buttonStyle(.plain)

                Text("\(qty)")
                    .font(.quantityLabel)
                    .foregroundStyle(Color.onSurface)
                    .frame(width: 22)
                    .multilineTextAlignment(.center)

                Button {
                    localQuantities[item.id] = qty + 1
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.outline)
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
            }
            .background(Color.surfaceContainer)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.outlineVariant.opacity(0.6), lineWidth: 1))
        }
        .padding(.vertical, 8)
        .background(Color.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .opacity(isSelected ? 1.0 : 0.45)
        .animation(.easeInOut(duration: 0.15), value: isSelected)
    }

    // MARK: - Submit bar

    private var submitBar: some View {
        // Determine which stores are represented in the current selection
        let selectedItems = viewModel.cartedItems.filter { selectedCartIds.contains($0.id) }
        let hasKroger = selectedItems.contains { $0.preference?.preferredUpc != nil }
        let hasAmazon = selectedItems.contains { $0.preference?.preferredAsin != nil }
        let storeLabel: String = {
            switch (hasKroger, hasAmazon) {
            case (true, true):  return "\(viewModel.storeName) + Amazon"
            case (true, false): return viewModel.storeName
            case (false, true): return "Amazon"
            default:            return "cart"
            }
        }()

        return Button {
            // Pre-check: if any selected items are Kroger and account isn't linked, show alert
            if hasKroger && !authManager.isKrogerLinked {
                showLinkAlert = true
                return
            }
            Task {
                await viewModel.submitCartSelection(selectedCartIds, quantityOverrides: localQuantities)
                if viewModel.errorMessage == nil {
                    dismiss()
                }
            }
        } label: {
            HStack(spacing: 8) {
                if viewModel.isSubmittingCart {
                    ProgressView().tint(Color.onPrimary)
                } else {
                    Image(systemName: "cart.badge.checkmark")
                }
                Text(viewModel.isSubmittingCart
                    ? "Submitting…"
                    : selectedCartIds.isEmpty
                        ? "Select items to submit"
                        : "Submit \(selectedCartIds.count) to \(storeLabel)")
                    .font(.subheadline.bold())
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
        }
        .foregroundStyle(Color.onPrimary)
        .background(selectedCartIds.isEmpty ? Color.primary.opacity(0.4) : Color.primary)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .disabled(viewModel.isSubmittingCart || selectedCartIds.isEmpty)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "cart")
                .font(.system(size: 48))
                .foregroundStyle(Color.outline)
            Text("Cart is empty")
                .font(.title3.bold())
                .foregroundStyle(Color.onSurface)
            Text("Add mapped items to your cart from the list")
                .font(.subheadline)
                .foregroundStyle(Color.onSurfaceVariant)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Helpers

    private func emojiView(_ item: UIListItem) -> some View {
        ZStack {
            Color.surfaceContainerLow
            Text(DepartmentEmoji.emoji(for: item.department))
                .font(.system(size: 20))
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

