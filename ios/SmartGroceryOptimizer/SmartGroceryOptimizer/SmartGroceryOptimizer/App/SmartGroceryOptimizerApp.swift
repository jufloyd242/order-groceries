import SwiftUI

@main
struct SmartGroceryOptimizerApp: App {
    @StateObject private var authManager = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .preferredColorScheme(.light)  // Always light — matches web dashboard
        }
    }
}
