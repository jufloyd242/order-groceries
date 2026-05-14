import SwiftUI

// MARK: - ItemSearchView
// Search for products for a single list item. Tap a result to save it as the
// preferred product for this item. Mirrors /app/pick/[itemId]/page.tsx.

struct ItemSearchView: View {
    let item: UIListItem
    /// Called when the user has successfully saved a product preference — parent should reload.
    var onSaved: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var query: String
    @State private var results: [ProductMatch] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var savedMessage: String?

    init(item: UIListItem, onSaved: (() -> Void)? = nil) {
        self.item = item
        self.onSaved = onSaved
        // Use clean product identity for search — normalizedText has quantity/unit stripped.
        // Fall back to rawText only if normalization hasn't run yet.
        _query = State(initialValue: item.preference?.displayName ?? item.normalizedText ?? item.rawText)
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Searching…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if results.isEmpty && !isLoading {
                    emptyState
                } else {
                    resultsList
                }
            }
            .navigationTitle(item.rawText)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .searchable(text: $query, prompt: "Search products…")
            .onSubmit(of: .search) { Task { await search() } }
            .task { await search() }
            .alert("Error", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    // MARK: - Results list

    private var resultsList: some View {
        List(results) { product in
            ProductRow(product: product, savedMessage: $savedMessage) {
                Task { await savePreference(product: product) }
            }
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
        }
        .listStyle(.plain)
        .overlay(alignment: .bottom) {
            if let msg = savedMessage {
                Text(msg)
                    .font(.subheadline.bold())
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.primary)
                    .foregroundStyle(Color.onPrimary)
                    .clipShape(Capsule())
                    .padding(.bottom, 16)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            withAnimation { savedMessage = nil }
                        }
                    }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: savedMessage)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 40))
                .foregroundStyle(Color.outline)
            Text("No results")
                .font(.title3.bold())
                .foregroundStyle(Color.onSurface)
            Text("Try a different search term")
                .font(.subheadline)
                .foregroundStyle(Color.onSurfaceVariant)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Search

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        struct SearchResponse: Decodable {
            let results: [ProductMatch]
        }

        do {
            let response: SearchResponse = try await APIClient.shared.get(
                "/api/search",
                queryItems: [URLQueryItem(name: "q", value: q)]
            )
            results = response.results
        } catch {
            errorMessage = "Search failed: \(error.localizedDescription)"
        }
    }

    // MARK: - Save preference

    private func savePreference(product: ProductMatch) async {
        struct PreferenceBody: Encodable {
            let listItemId: String
            let productId: String
            let store: StoreId
            let displayName: String
            let preferredUpc: String?
            let preferredAsin: String?
            let imageUrl: String?
            let genericName: String

            enum CodingKeys: String, CodingKey {
                case listItemId = "list_item_id"
                case productId = "product_id"
                case store
                case displayName = "display_name"
                case preferredUpc = "preferred_upc"
                case preferredAsin = "preferred_asin"
                case imageUrl = "image_url"
                case genericName = "generic_name"
            }
        }
        struct PrefResponse: Decodable { let success: Bool? }

        do {
            let _: PrefResponse = try await APIClient.shared.post(
                "/api/preferences",
                body: PreferenceBody(
                    listItemId: item.id,
                    productId: product.id,
                    store: product.store,
                    displayName: product.name,
                    preferredUpc: product.upc,
                    preferredAsin: product.asin,
                    imageUrl: product.imageUrl,
                    genericName: item.normalizedText ?? item.rawText
                )
            )
            withAnimation { savedMessage = "Saved: \(product.name)" }
            // Dismiss after brief confirmation toast, signal parent to reload
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            onSaved?()
            dismiss()
        } catch {
            errorMessage = "Couldn't save preference: \(error.localizedDescription)"
        }
    }
}

// MARK: - Product row

private struct ProductRow: View {
    let product: ProductMatch
    @Binding var savedMessage: String?
    let onSave: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Thumbnail
            AsyncImage(url: URL(string: product.imageUrl ?? "")) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Image(systemName: "photo")
                    .font(.system(size: 20))
                    .foregroundStyle(Color.outline)
            }
            .frame(width: 52, height: 52)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .background(Color.surfaceContainerHighest)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(product.name)
                    .font(.subheadline.bold())
                    .lineLimit(2)
                    .foregroundStyle(Color.onSurface)
                Text("\(product.brand) · \(product.size)")
                    .font(.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                HStack(spacing: 4) {
                    Text("$\(product.price, specifier: "%.2f")")
                        .font(.subheadline.bold())
                        .foregroundStyle(Color.primary)
                    Text(product.store == .kroger ? "King Soopers" : "Amazon")
                        .font(.caption)
                        .foregroundStyle(Color.onSurfaceVariant)
                }
            }

            Spacer()

            Button {
                onSave()
            } label: {
                Image(systemName: "checkmark.circle")
                    .font(.system(size: 24))
                    .foregroundStyle(Color.primary)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(Color.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
