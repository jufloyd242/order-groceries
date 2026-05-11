import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var errorMessage: String?
    #if targetEnvironment(simulator)
    @State private var showDevLogin = false
    @State private var devToken = ""
    #endif

    private var isMisconfigured: Bool { !APIConfig.isConfigured }

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

            // ── Config warning (shown when SGO.xcconfig isn't filled in) ──
            if isMisconfigured {
                VStack(spacing: 8) {
                    Label("Supabase credentials missing", systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote.bold())
                        .foregroundStyle(Color.error)
                    Text("Open ios/SGO.xcconfig and fill in your SUPABASE_URL and SUPABASE_ANON_KEY, then rebuild.")
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Color.onSurfaceVariant)
                }
                .padding(12)
                .background(Color.errorContainer)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
                .padding(.horizontal, 32)
                .padding(.bottom, 16)
            }

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
                .background(isMisconfigured ? Color.outline : Color.primary)
                .foregroundStyle(Color.onPrimary)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            }
            .disabled(authManager.isLoading || isMisconfigured)
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

            #if targetEnvironment(simulator)
            Button("Dev: Paste Token") { showDevLogin = true }
                .font(.caption)
                .foregroundStyle(Color.outline)
                .padding(.bottom, 8)
            #endif
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.surface)
        #if targetEnvironment(simulator)
        .sheet(isPresented: $showDevLogin) {
            NavigationStack {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Paste your Supabase access_token below.")
                        .font(.subheadline)
                    Text("1. Open http://localhost:3000 in Chrome\n2. Sign in with Google\n3. DevTools → Application → Local Storage\n4. Find sb-kxkynihljfakhundqmed-auth-token\n5. Copy the access_token value (starts with eyJ)")
                        .font(.caption)
                        .foregroundStyle(Color.onSurfaceVariant)
                    TextEditor(text: $devToken)
                        .font(.system(.caption, design: .monospaced))
                        .frame(minHeight: 140)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.outline))
                    Button("Apply Token & Sign In") {
                        let t = devToken.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !t.isEmpty else { return }
                        authManager.setSessionFromToken(t)
                        showDevLogin = false
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(devToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    Spacer()
                }
                .padding()
                .navigationTitle("Dev Login (Simulator)")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showDevLogin = false }
                    }
                }
            }
        }
        #endif
    }

    // MARK: - Actions

    private func signIn() async {
        errorMessage = nil

        // Get the presenting window from the current scene
        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let window = windowScene.keyWindow else {
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
