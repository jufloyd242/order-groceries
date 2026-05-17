import SwiftUI

// MARK: - Fresh Harvest Design Tokens
// Mirrors: app/globals.css — @theme block + :root variables

extension Color {
    // MARK: Surfaces
    static let surface              = Color(hex: "#F9FAFB")
    static let surfaceDim           = Color(hex: "#d9dadb")
    static let surfaceBright        = Color(hex: "#F9FAFB")
    static let surfaceContainerLowest = Color(hex: "#ffffff")
    static let surfaceContainerLow  = Color(hex: "#f3f4f5")
    static let surfaceContainer     = Color(hex: "#edeeef")
    static let surfaceContainerHigh = Color(hex: "#e7e8e9")
    static let surfaceContainerHighest = Color(hex: "#e1e3e4")

    // MARK: On Surface
    static let onSurface            = Color(hex: "#111827")
    static let onSurfaceVariant     = Color(hex: "#374151")
    static let outline              = Color(hex: "#707973")
    static let outlineVariant       = Color(hex: "#bfc9c1")

    // MARK: Primary — emerald green
    static let primary              = Color(hex: "#10B981")
    static let onPrimary            = Color(hex: "#111827")
    static let primaryContainer     = Color(hex: "#059669")
    static let onPrimaryContainer   = Color(hex: "#a8e7c5")

    // MARK: Secondary — deep emerald
    static let secondary            = Color(hex: "#047857")
    static let secondaryContainer   = Color(hex: "#b0f1cc")

    // MARK: Tertiary — zesty orange
    static let tertiary             = Color(hex: "#653f00")
    static let tertiaryContainer    = Color(hex: "#855500")

    // MARK: Error
    static let error                = Color(hex: "#ba1a1a")
    static let errorContainer       = Color(hex: "#ffdad6")

    // MARK: Store branding
    static let kroger               = Color(hex: "#2B6CB0")
    static let krogerBg             = Color(hex: "#2B6CB0").opacity(0.12)
    static let amazon               = Color(hex: "#FF9900")
    static let amazonBg             = Color(hex: "#FF9900").opacity(0.12)

    // MARK: Status
    static let cartedGreen          = Color(hex: "#22c55e")

    // MARK: Hex initializer
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)

        let r = Double((rgbValue & 0xFF0000) >> 16) / 255.0
        let g = Double((rgbValue & 0x00FF00) >> 8) / 255.0
        let b = Double((rgbValue & 0x0000FF)) / 255.0

        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Typography

extension Font {
    static let itemName = Font.system(size: 14, weight: .semibold)
    static let itemDetail = Font.system(size: 11)
    static let badge = Font.system(size: 10, weight: .semibold)
    static let quantityLabel = Font.system(size: 12, weight: .bold)
}

// MARK: - Spacing

enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
}

// MARK: - Corner Radius

enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let full: CGFloat = 9999
}
