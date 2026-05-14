import SwiftUI

// MARK: - CartView
// Shows items currently in the cart (.carted status) and allows submission.
// Presented as a sheet from GroceryListView toolbar cart button.

struct CartView: View {
    @ObservedObject var viewModel: GroceryListViewModel
    @Environment(\.dismiss) private var dismiss

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
        }
    }

    // MARK: - Cart list

    private var cartList: some View {
        List {
            Section {
                ForEach(viewModel.cartedItems) { item in
                    HStack(spacing: 12) {
                        // Thumbnail
                        if let url = item.preference?.imageUrl, let imageURL = URL(string: url) {
                            AsyncImage(url: imageURL) { phase in
                                switch phase {
                                case .success(let image):
                                    image.resizable().scaledToFill()
                                default:
                                    emojiView(item)
                                }
                            }
                            .frame(width: 44, height: 44)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        } else {
                            emojiView(item)
                                .frame(width: 44, height: 44)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.preference?.displayName ?? item.normalizedText ?? item.rawText)
                                .font(.subheadline.bold())
                                .lineLimit(1)
                            if let upc = item.preference?.preferredUpc {
                                Text("UPC: \(upc)")
                                    .font(.caption)
                                    .foregroundStyle(Color.outline)
                            } else if let asin = item.preference?.preferredAsin {
                                Text("ASIN: \(asin)")
                                    .font(.caption)
                                    .foregroundStyle(Color.outline)
                            }
                        }

                        Spacer()

                        Text("×\(Int(item.quantity ?? 1))")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.onSurfaceVariant)
                    }
                    .padding(.vertical, 2)
                }
            } header: {
                Text("\(viewModel.cartedItems.count) item\(viewModel.cartedItems.count == 1 ? "" : "s") ready to submit")
                    .font(.caption)
                    .foregroundStyle(Color.outline)
            }
        }
        .listStyle(.insetGrouped)
        .safeAreaInset(edge: .bottom) {
            submitBar
        }
    }

    // MARK: - Submit bar

    private var submitBar: some View {
        Button {
            Task {
                await viewModel.submitCart()
                if viewModel.errorMessage == nil {
                    dismiss()
                }
            }
        } label: {
            HStack {
                if viewModel.isSubmittingCart {
                    ProgressView().tint(Color.onPrimary)
                } else {
                    Image(systemName: "cart.badge.checkmark")
                }
                Text(viewModel.isSubmittingCart
                    ? "Submitting…"
                    : "Submit to \(viewModel.storeName)")
                    .font(.subheadline.bold())
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
        }
        .foregroundStyle(Color.onPrimary)
        .background(Color.primary)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .disabled(viewModel.isSubmittingCart || viewModel.cartedItems.isEmpty)
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
