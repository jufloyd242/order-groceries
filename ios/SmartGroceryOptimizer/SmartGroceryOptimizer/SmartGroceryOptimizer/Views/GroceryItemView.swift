import SwiftUI

// MARK: - GroceryItemView
// Mirrors: components/ListItem.tsx — the primary list row component
// Supports: pending, carted, purchased, pinned, skipped states
// Progressive disclosure: mapping detail shown only when preference differs from raw text

struct GroceryItemView: View {
    let item: UIListItem
    let selected: Bool
    var skipped: Bool = false

    // Actions
    var onToggle: ((String) -> Void)?
    var onRemove: ((String) -> Void)?
    var onTogglePersistent: ((String) -> Void)?
    var onQuantityChange: ((String, Int) -> Void)?
    var onSkip: ((String) -> Void)?
    var onSearch: ((String) -> Void)?

    private var isCarted: Bool { item.status == .carted }
    private var isPurchased: Bool { item.status == .purchased }
    private var isLocked: Bool { isCarted || isPurchased }
    private var isPinned: Bool { item.persistent == true }
    private var qty: Int { Int(item.quantity ?? 1) }
    private var imageUrl: String? { item.preference?.imageUrl }

    /// Whether the preference display name differs from the raw text
    private var mappingDiffers: Bool {
        guard let pref = item.preference else { return false }
        return pref.displayName.trimmingCharacters(in: .whitespaces).lowercased()
            != item.rawText.trimmingCharacters(in: .whitespaces).lowercased()
    }

    var body: some View {
        HStack(spacing: 12) {
            // ── Checkbox ──
            checkboxView

            // ── Thumbnail ──
            thumbnailView

            // ── Text block ──
            // Unmapped item: tap anywhere on the body → open search (discovery-first)
            // Mapped item: tap anywhere on the body → toggle selection
            VStack(alignment: .leading, spacing: 2) {
                nameRow
                if mappingDiffers {
                    mappingSubline
                }
                // Measurement requirement label (e.g. "Need: 1/2 cup")
                if let label = item.measurementLabel {
                    HStack(spacing: 3) {
                        Text("📏")
                            .font(.system(size: 10))
                        Text(label)
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(Color.accentColor)
                }
                // Unmapped hint — prompt user to search for a product
                if item.preference == nil && !isLocked && !skipped {
                    HStack(spacing: 3) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 10, weight: .medium))
                        Text("Tap to find product")
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundStyle(Color.primary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .onTapGesture {
                guard !isLocked && !skipped else { return }
                if item.preference == nil {
                    // Unmapped → discovery-first: open search
                    onSearch?(item.id)
                } else {
                    // Mapped → toggle selection for cart
                    onToggle?(item.id)
                }
            }

            Spacer(minLength: 4)

            // ── Right zone: quantity or locked badge ──
            if !isLocked {
                quantityPill
            } else if qty > 1 {
                lockedQtyBadge
            }
        }
        .padding(.horizontal, isPinned ? 13 : 16)
        .padding(.vertical, 12)
        .background(Color.surfaceContainerLowest)
        .overlay(alignment: .leading) {
            // Pinned indicator — left border accent
            if isPinned {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.primary)
                    .frame(width: 3)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .opacity(skipped ? 0.4 : 1.0)
        .animation(.easeInOut(duration: 0.15), value: skipped)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            if !isLocked {
                Button(role: .destructive) {
                    onRemove?(item.id)
                } label: {
                    Label("Remove", systemImage: "trash")
                }
            }
        }
        .swipeActions(edge: .leading, allowsFullSwipe: false) {
            if !isLocked {
                Button {
                    onSearch?(item.id)
                } label: {
                    Label("Search", systemImage: "magnifyingglass")
                }
                .tint(.blue)

                Button {
                    onTogglePersistent?(item.id)
                } label: {
                    Label(isPinned ? "Unpin" : "Pin", systemImage: isPinned ? "pin.slash" : "pin")
                }
                .tint(Color.primary)
            }
        }
    }

    // MARK: - Checkbox

    private var checkboxView: some View {
        Button {
            if !isLocked && !skipped {
                onToggle?(item.id)
            }
        } label: {
            Image(systemName: checkboxIcon)
                .font(.system(size: 20))
                .foregroundStyle(checkboxColor)
        }
        .buttonStyle(.plain)
        .disabled(isLocked || skipped)
        .opacity(isLocked || skipped ? 0.45 : 1)
        .accessibilityLabel("Select \(item.rawText)")
    }

    private var checkboxIcon: String {
        if isPurchased { return "checkmark.circle.fill" }
        if selected { return "checkmark.circle.fill" }
        return "circle"
    }

    private var checkboxColor: Color {
        if isPurchased { return .outline }
        if selected { return .primary }
        return .outlineVariant
    }

    // MARK: - Thumbnail

    private var thumbnailView: some View {
        Group {
            if let url = imageUrl, let imageURL = URL(string: url) {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure:
                        emojiPlaceholder
                    default:
                        Color.surfaceContainerLow
                    }
                }
            } else {
                emojiPlaceholder
            }
        }
        .frame(width: 48, height: 48)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(Color.surfaceContainer, lineWidth: 1)
        )
        .opacity(isLocked ? 0.45 : 1)
    }

    private var emojiPlaceholder: some View {
        ZStack {
            Color.surfaceContainerLow
            if item.preference == nil && !isLocked {
                // Unmapped: show search icon instead of emoji
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Color.primary.opacity(0.6))
            } else {
                Text(DepartmentEmoji.emoji(for: item.department))
                    .font(.system(size: 20))
            }
        }
    }

    // MARK: - Name Row

    private var nameRow: some View {
        HStack(spacing: 6) {
            // Show clean product identity (normalizedText), fall back to rawText
            let displayName = (item.normalizedText ?? item.rawText)
                .prefix(1).uppercased() + (item.normalizedText ?? item.rawText).dropFirst()
            Text(displayName)
                .font(.itemName)
                .foregroundStyle(Color.onSurface)
                .lineLimit(1)
                .truncationMode(.tail)
                .strikethrough(isLocked)
                .opacity(isLocked ? 0.5 : 1)

            // Unit badge (e.g. cup, oz, lb) — shown for measured ingredients
            if !isLocked, let unit = item.unit {
                Text(unit)
                    .font(.badge)
                    .foregroundStyle(Color.primary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.primary.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }

            // Status dots
            if isCarted {
                Circle()
                    .fill(Color.cartedGreen)
                    .frame(width: 7, height: 7)
                    .shadow(color: .cartedGreen.opacity(0.5), radius: 2, y: 0)
                    .accessibilityLabel("In cart")
            }
            if isPurchased {
                Circle()
                    .fill(Color.outline)
                    .frame(width: 7, height: 7)
                    .accessibilityLabel("Purchased")
            }

            // Todoist badge
            if !isLocked && item.source == .todoist {
                Text("Todoist")
                    .font(.badge)
                    .foregroundStyle(Color.kroger)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.kroger.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }

            // Pinned indicator
            if isPinned && !isLocked {
                Image(systemName: "pin.fill")
                    .font(.system(size: 9))
                    .foregroundStyle(Color.primary)
                    .accessibilityLabel("Pinned staple")
            }
        }
    }

    // MARK: - Mapping Subline (progressive detail)

    private var mappingSubline: some View {
        HStack(spacing: 2) {
            Text(item.preference!.displayName)
                .font(.itemDetail)
                .foregroundStyle(Color.outline)
                .lineLimit(1)
                .truncationMode(.tail)
            Text("✏️")
                .font(.system(size: 10))
        }
    }

    // MARK: - Quantity Pill

    private var quantityPill: some View {
        HStack(spacing: 0) {
            Button {
                let next = max(1, qty - 1)
                onQuantityChange?(item.id, next)
            } label: {
                Image(systemName: "minus")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(qty <= 1 ? Color.outlineVariant : Color.outline)
                    .frame(width: 28, height: 28)
            }
            .disabled(qty <= 1)
            .buttonStyle(.plain)

            Text("\(qty)")
                .font(.quantityLabel)
                .foregroundStyle(Color.onSurface)
                .frame(width: 24)
                .multilineTextAlignment(.center)

            Button {
                onQuantityChange?(item.id, qty + 1)
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.outline)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
        }
        .background(Color.surfaceContainer)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(Color.outlineVariant.opacity(0.6), lineWidth: 1)
        )
    }

    // MARK: - Locked Quantity Badge

    private var lockedQtyBadge: some View {
        Text("×\(qty)")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Color.outline)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color.surfaceContainer)
            .clipShape(Capsule())
    }
}

// MARK: - Previews

#Preview("Pending — No Preference") {
    List {
        GroceryItemView(
            item: .preview(
                rawText: "milk",
                status: .pending,
                department: "Dairy"
            ),
            selected: false
        )
        GroceryItemView(
            item: .preview(
                rawText: "bananas",
                status: .pending,
                quantity: 3,
                department: "Produce"
            ),
            selected: true
        )
    }
    .listStyle(.plain)
}

#Preview("Pinned Staples") {
    List {
        GroceryItemView(
            item: .preview(
                rawText: "eggs",
                status: .pending,
                persistent: true,
                department: "Dairy",
                preference: .init(
                    displayName: "Kroger Large Eggs, 18 ct",
                    preferredUpc: "001",
                    preferredAsin: nil,
                    imageUrl: nil
                )
            ),
            selected: false
        )
        GroceryItemView(
            item: .preview(
                rawText: "bread",
                status: .pending,
                persistent: true,
                department: "Bakery"
            ),
            selected: false,
            skipped: true
        )
    }
    .listStyle(.plain)
}

#Preview("In Cart") {
    List {
        GroceryItemView(
            item: .preview(
                rawText: "Horizon Organic Milk",
                status: .carted,
                quantity: 2,
                department: "Dairy"
            ),
            selected: false
        )
    }
    .listStyle(.plain)
}

#Preview("Purchased") {
    List {
        GroceryItemView(
            item: .preview(
                rawText: "toilet paper",
                status: .purchased,
                department: "Household",
                preference: .init(
                    displayName: "Charmin Ultra Soft, 12 Mega Rolls",
                    preferredUpc: "001",
                    preferredAsin: nil,
                    imageUrl: nil
                )
            ),
            selected: false
        )
    }
    .listStyle(.plain)
}

#Preview("Todoist Source") {
    List {
        GroceryItemView(
            item: .preview(
                rawText: "chicken breast",
                status: .pending,
                source: .todoist,
                department: "Meat"
            ),
            selected: false
        )
    }
    .listStyle(.plain)
}

// MARK: - Preview Helper

extension UIListItem {
    static func preview(
        id: String = UUID().uuidString,
        rawText: String,
        status: ItemStatus = .pending,
        quantity: Double? = 1,
        unit: String? = nil,
        quantityType: String? = nil,
        minRequiredAmount: Double? = nil,
        minRequiredUnit: String? = nil,
        source: ItemSource = .manual,
        persistent: Bool? = nil,
        department: String? = nil,
        preference: UIListItemPreference? = nil
    ) -> UIListItem {
        UIListItem(
            id: id,
            rawText: rawText,
            normalizedText: rawText.lowercased(),
            quantity: quantity,
            unit: unit,
            quantityType: quantityType,
            minRequiredAmount: minRequiredAmount,
            minRequiredUnit: minRequiredUnit,
            source: source,
            todoistTaskId: source == .todoist ? "tod-\(id)" : nil,
            preferenceId: preference != nil ? "pref-\(id)" : nil,
            status: status,
            createdAt: Date(),
            purchasedAt: status == .purchased ? Date() : nil,
            persistent: persistent,
            department: department,
            preference: preference
        )
    }
}
