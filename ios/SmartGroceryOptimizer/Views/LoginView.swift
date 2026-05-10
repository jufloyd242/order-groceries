import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // ── Logo + Title ──
            VStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radius.lg)
                        .fill(Color.primary.opacity(0.08))
                        .frame(width: 80, height: 80)
                    Image(systemName: "cart.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(Color.primary)
                }

                Text("Smart Grocery\nOptimizer")
                    .font(.system(size: 28, weight: .bold, design: .default))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.onSurface)

                Text("Compare King Soopers & Amazon.\nShop smarter in minutes.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
            .padding(.bottom, 48)

            // ── Sign In Button ──
            Button {
                Task { await signIn() }
            } label: {
                HStack(spacing: 10) {
                    // Google "G" logo approximation with SF Symbol
                    Image(systemName: "globe")
                        .font(.system(size: 18, weight: .medium))

                    Text(authManager.isLoading ? "Signing in…" : "Sign in with Google")
                        .font(.system(size: 16, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.primary)
                .foregroundStyle(Color.onPrimary)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            }
            .disabled(authManager.isLoading)
            .padding(.horizontal, 32)
            .overlay {
                if authManager.isLoading {
                    RoundedRectangle(cornerRadius: Radius.md)
                        .fill(Color.primary.opacity(0.6))
                        .padding(.horizontal, 32)
                        .overlay {
                            ProgressView()
                                .tint(.white)
                        }
                }
            }

            // ── Error message ──
            if let error = errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.error)
                    .multilineTextAlignment(.center)
                    .padding(.top, 12)
                    .padding(.horizontal, 32)
            }

            Spacer()

            // ── Footer ──
            Text("Your data is private and tied to your account.")
                .font(.caption)
                .foregroundStyle(Color.outline)
                .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.surface)
    }

    // MARK: - Actions

    private func signIn() async {
        errorMessage = nil

        // Get the presenting window from the current scene
        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let window = windowScene.windows.first(where: { $0.isKeyWindow }) else {
            errorMessage = "Could not find a window to present sign-in."
            return
        }

        do {
            try await authManager.signInWithGoogle(presentationAnchor: window)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthManager.shared)
}
