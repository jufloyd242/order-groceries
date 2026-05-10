import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        Group {
            if authManager.isLoading {
                splashView
            } else if authManager.isAuthenticated {
                // Stub — will be replaced with TabView + real screens
                Text("✓ Authenticated as \(authManager.userEmail ?? "user")")
                    .foregroundStyle(Color.onSurface)
            } else {
                LoginView()
            }
        }
        .task {
            await authManager.refreshSession()
        }
    }

    private var splashView: some View {
        VStack(spacing: 16) {
            Image(systemName: "cart.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.primary)
            Text("Smart Grocery Optimizer")
                .font(.title2.bold())
                .foregroundStyle(Color.onSurface)
            ProgressView()
                .tint(Color.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.surface)
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthManager.shared)
}
