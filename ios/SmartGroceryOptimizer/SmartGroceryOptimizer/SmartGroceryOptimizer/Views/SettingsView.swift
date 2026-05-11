import SwiftUI

// MARK: - SettingsView
// Displays read-only app configuration from GET /api/settings.
// Mirrors /app/settings/page.tsx.

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.dismiss) private var dismiss
    @State private var settings: AppSettings?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading settings…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let settings {
                    settingsList(settings)
                } else {
                    emptyState
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("Error", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
        .task { await loadSettings() }
    }

    // MARK: - Settings list

    private func settingsList(_ s: AppSettings) -> some View {
        List {
            Section("Store") {
                if let chain = s.storeChain { SettingsRow(label: "Chain", value: chain) }
                if let locId = s.krogerLocationId { SettingsRow(label: "Location ID", value: locId) }
                if let storeName = s.krogerStoreName, !storeName.isEmpty { SettingsRow(label: "Store Name", value: storeName) }
                if let modality = s.orderModality { SettingsRow(label: "Order Mode", value: modality.capitalized) }
            }

            Section("Location") {
                if let zip = s.defaultZipCode { SettingsRow(label: "ZIP Code", value: zip) }
            }

            Section("Todoist") {
                if let project = s.todoistProjectName { SettingsRow(label: "Project", value: project) }
            }

            Section("Account") {
                if let email = authManager.userEmail {
                    SettingsRow(label: "Signed in as", value: email)
                }
                Button(role: .destructive) {
                    Task { await authManager.signOut() }
                } label: {
                    Text("Sign Out")
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "gear")
                .font(.system(size: 40))
                .foregroundStyle(Color.outline)
            Text("Settings not found")
                .font(.headline)
                .foregroundStyle(Color.onSurface)
            Button("Retry") { Task { await loadSettings() } }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Load

    private func loadSettings() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        struct SettingsResponse: Decodable {
            let settings: AppSettings
        }

        do {
            let response: SettingsResponse = try await APIClient.shared.get("/api/settings")
            settings = response.settings
        } catch {
            errorMessage = "Failed to load settings: \(error.localizedDescription)"
        }
    }
}

// MARK: - SettingsRow

private struct SettingsRow: View {
    let label: String
    let value: String

    var body: some View {
        LabeledContent(label) {
            Text(value)
                .foregroundStyle(Color.onSurfaceVariant)
                .multilineTextAlignment(.trailing)
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(AuthManager.shared)
}
