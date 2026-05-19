import SwiftUI

// MARK: - AmazonHandoffView
// Presents a list of Amazon items that need manual add-to-cart.
// User opens each product page in SFSafariViewController, then marks "Done".
// Only confirmed items are cleaned up (marked purchased) on dismiss.

struct AmazonHandoffView: View {
    @ObservedObject var viewModel: GroceryListViewModel
    @Environment(\.dismiss) private var dismiss

    /// Tracks which items the user has confirmed adding to their Amazon cart
    @State private var confirmedAsins: Set<String> = []
    /// Which link is currently open in SafariView
    @State private var openUrl: URL?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header explanation
                VStack(alignment: .leading, spacing: 6) {
                    Text("Open each item on Amazon and tap \"Add to Cart\" on the product page.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text("Mark items as done after adding them.")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.surfaceContainerLowest)

                Divider()

                // Item list
                List {
                    ForEach(viewModel.pendingAmazonLinks) { link in
                        handoffRow(link)
                    }
                }
                .listStyle(.plain)

                Divider()

                // Bottom bar
                bottomBar
            }
            .navigationTitle("Amazon Items")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Skip All") {
                        viewModel.dismissAmazonHandoff()
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: Binding(
                get: { openUrl != nil },
                set: { if !$0 { openUrl = nil } }
            )) {
                if let url = openUrl {
                    SafariView(url: url)
                }
            }
        }
    }

    // MARK: - Row

    private func handoffRow(_ link: AmazonHandoffLink) -> some View {
        let isDone = confirmedAsins.contains(link.asin)

        return HStack(spacing: 12) {
            // Done checkmark
            Image(systemName: isDone ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(isDone ? Color.green : Color.secondary)
                .font(.title3)
                .onTapGesture { toggleConfirmed(link.asin) }

            // Item info
            VStack(alignment: .leading, spacing: 2) {
                Text(link.name)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)
                if link.quantity > 1 {
                    Text("Qty: \(link.quantity)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            // Open button
            Button {
                if let url = URL(string: link.url) {
                    openUrl = url
                }
            } label: {
                Label("Open", systemImage: "safari")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.accentColor.opacity(0.12))
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
        .opacity(isDone ? 0.6 : 1.0)
    }

    // MARK: - Bottom Bar

    private var bottomBar: some View {
        let confirmedCount = confirmedAsins.count
        let total = viewModel.pendingAmazonLinks.count

        return VStack(spacing: 8) {
            // Progress indicator
            Text("\(confirmedCount) of \(total) confirmed")
                .font(.caption)
                .foregroundStyle(.secondary)

            Button {
                finishHandoff()
            } label: {
                Text(confirmedCount == 0 ? "Done (skip all)" : "Done — mark \(confirmedCount) as purchased")
                    .font(.subheadline.bold())
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .foregroundStyle(Color.onPrimary)
            .background(Color.primary)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .padding(.horizontal, 16)
        }
        .padding(.vertical, 12)
        .background(Color.surfaceContainerLowest)
    }

    // MARK: - Actions

    private func toggleConfirmed(_ asin: String) {
        if confirmedAsins.contains(asin) {
            confirmedAsins.remove(asin)
        } else {
            confirmedAsins.insert(asin)
        }
    }

    private func finishHandoff() {
        // Collect listItemIds for confirmed items only
        let confirmedListItemIds = viewModel.pendingAmazonLinks
            .filter { confirmedAsins.contains($0.asin) }
            .compactMap(\.listItemId)

        Task {
            await viewModel.confirmAmazonHandoff(confirmedListItemIds)
        }
        dismiss()
    }
}
