import SwiftUI

// MARK: - SettingsView
// Editable app configuration that reads from / writes to GET+POST /api/settings.
// Also provides King Soopers OAuth link/unlink and store location search.
// Mirrors /app/settings/page.tsx.

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.dismiss) private var dismiss

    // Remote settings snapshot
    @State private var settings: AppSettings?

    // Editable field state (populated once settings load)
    @State private var zipCode: String = ""
    @State private var todoistProjectName: String = ""

    // Location search
    @State private var locations: [KrogerLocation] = []
    @State private var isSearchingLocations = false
    @State private var showLocationPicker = false

    // Todoist project picker
    @State private var todoistProjects: [TodoistProject] = []
    @State private var isLoadingProjects = false
    @State private var selectedProjectName: String = ""

    // Async state
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading settings…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    settingsList
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
            .overlay(alignment: .bottom) {
                if let msg = successMessage {
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
                                withAnimation { successMessage = nil }
                            }
                        }
                }
            }
            .animation(.easeInOut(duration: 0.3), value: successMessage)
        }
        .task { await loadSettings() }
    }

    // MARK: - Settings List

    private var settingsList: some View {
        List {
            krogerSection
            locationSection
            todoistSection
            accountSection
        }
        .listStyle(.insetGrouped)
    }

    // MARK: - King Soopers Section

    private var krogerSection: some View {
        Section {
            if authManager.isKrogerLinked {
                HStack {
                    Label("King Soopers", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(Color.primary)
                    Spacer()
                    Text("Linked")
                        .font(.caption)
                        .foregroundStyle(Color.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.primary.opacity(0.1))
                        .clipShape(Capsule())
                }

                Button(role: .destructive) {
                    Task { await authManager.unlinkKingSoopers() }
                } label: {
                    Label("Unlink Account", systemImage: "xmark.circle")
                }
            } else {
                Button {
                    Task { await linkKingSoopers() }
                } label: {
                    Label("Link King Soopers Account", systemImage: "link")
                        .foregroundStyle(Color.primary)
                }
            }
        } header: {
            Text("King Soopers")
        } footer: {
            Text(authManager.isKrogerLinked
                 ? "Your King Soopers account is linked. Items with a UPC will be added to your cart automatically."
                 : "Link your account to enable one-tap cart submission.")
        }
    }

    // MARK: - Location Section

    private var locationSection: some View {
        Section("King Soopers Store Location") {
            // ZIP Code row
            HStack {
                TextField("ZIP Code", text: $zipCode)
                    .keyboardType(.numberPad)
                    .textContentType(.postalCode)
                    .submitLabel(.search)
                    .onSubmit { Task { await findStores() } }

                if isSearchingLocations {
                    ProgressView()
                        .padding(.leading, 8)
                } else {
                    Button {
                        Task { await findStores() }
                    } label: {
                        Text("Find Store")
                            .font(.subheadline.bold())
                            .foregroundStyle(Color.primary)
                    }
                    .buttonStyle(.plain)
                    .disabled(zipCode.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }

            // Current store
            if let storeName = settings?.krogerStoreName, !storeName.isEmpty {
                SettingsRow(label: "Selected Store", value: storeName)
            } else if let locId = settings?.krogerLocationId, !locId.isEmpty {
                SettingsRow(label: "Location ID", value: locId)
            }

            // Location search results
            if !locations.isEmpty {
                ForEach(locations) { loc in
                    Button {
                        Task { await selectLocation(loc) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(loc.displayName)
                                    .font(.subheadline)
                                    .foregroundStyle(Color.onSurface)
                                Text(loc.addressLine)
                                    .font(.caption)
                                    .foregroundStyle(Color.onSurfaceVariant)
                            }
                            Spacer()
                            if settings?.krogerLocationId == loc.locationId {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.primary)
                                    .font(.caption.bold())
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Todoist Section

    private var todoistSection: some View {
        Section {
            if authManager.isTodoistLinked {
                HStack {
                    Label("Todoist", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(Color.primary)
                    Spacer()
                    Text("Linked")
                        .font(.caption)
                        .foregroundStyle(Color.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.primary.opacity(0.1))
                        .clipShape(Capsule())
                }

                // Project picker
                if isLoadingProjects {
                    HStack {
                        Text("Loading projects…")
                            .foregroundStyle(.secondary)
                        Spacer()
                        ProgressView()
                    }
                } else if !todoistProjects.isEmpty {
                    Picker("Grocery Project", selection: $selectedProjectName) {
                        ForEach(todoistProjects) { project in
                            Text(project.name).tag(project.name)
                        }
                    }
                    .onChange(of: selectedProjectName) { _, newValue in
                        guard !newValue.isEmpty else { return }
                        Task { await saveSettings(["todoist_project_name": newValue]) }
                    }
                } else {
                    HStack {
                        TextField("Project name", text: $todoistProjectName)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .submitLabel(.done)
                            .onSubmit { Task { await saveTodoistProject() } }

                        Button {
                            Task { await saveTodoistProject() }
                        } label: {
                            Text("Save")
                                .font(.subheadline.bold())
                                .foregroundStyle(Color.primary)
                        }
                        .buttonStyle(.plain)
                        .disabled(isSaving)
                    }
                }

                Button(role: .destructive) {
                    Task { await authManager.unlinkTodoist() }
                } label: {
                    Label("Unlink Account", systemImage: "xmark.circle")
                }
            } else {
                Button {
                    Task { await linkTodoist() }
                } label: {
                    Label("Link Todoist Account", systemImage: "link")
                        .foregroundStyle(Color.primary)
                }
            }
        } header: {
            Text("Todoist")
        } footer: {
            Text(authManager.isTodoistLinked
                 ? "Your Todoist account is linked. Select the project containing your grocery list."
                 : "Link your Todoist account to sync your grocery list automatically.")
        }
        .task {
            if authManager.isTodoistLinked {
                await loadTodoistProjects()
            }
        }
        .onChange(of: authManager.isTodoistLinked) { _, linked in
            if linked {
                Task { await loadTodoistProjects() }
            } else {
                todoistProjects = []
            }
        }
    }

    // MARK: - Account Section

    private var accountSection: some View {
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

    // MARK: - Actions

    private func loadSettings() async {
        isLoading = true
        defer { isLoading = false }

        struct SettingsResponse: Decodable { let settings: AppSettings }
        do {
            let response: SettingsResponse = try await APIClient.shared.get("/api/settings")
            settings = response.settings
            zipCode = response.settings.defaultZipCode ?? ""
            todoistProjectName = response.settings.todoistProjectName ?? ""
        } catch {
            errorMessage = "Failed to load settings: \(error.localizedDescription)"
        }
    }

    private func saveSettings(_ updates: [String: String]) async {
        isSaving = true
        defer { isSaving = false }

        struct SaveResponse: Decodable { let success: Bool?; let updated: Int? }
        do {
            let _: SaveResponse = try await APIClient.shared.post("/api/settings", body: updates)
            withAnimation { successMessage = "Saved" }
            await loadSettings()
        } catch {
            errorMessage = "Failed to save: \(error.localizedDescription)"
        }
    }

    private func findStores() async {
        let zip = zipCode.trimmingCharacters(in: .whitespaces)
        guard !zip.isEmpty else { return }
        isSearchingLocations = true
        locations = []
        defer { isSearchingLocations = false }

        struct LocationsResponse: Decodable {
            let locations: [KrogerLocation]
        }
        do {
            let response: LocationsResponse = try await APIClient.shared.get(
                "/api/kroger/locations",
                queryItems: [URLQueryItem(name: "zip", value: zip)]
            )
            locations = response.locations
            if locations.isEmpty {
                errorMessage = "No King Soopers stores found near \(zip). Try a different ZIP code."
            }
        } catch {
            errorMessage = "Store search failed: \(error.localizedDescription)"
        }
    }

    private func selectLocation(_ loc: KrogerLocation) async {
        await saveSettings([
            "kroger_location_id": loc.locationId,
            "kroger_store_name": loc.displayName,
            "default_zip_code": zipCode,
        ])
        locations = []
    }

    private func saveTodoistProject() async {
        let name = todoistProjectName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        await saveSettings(["todoist_project_name": name])
    }

    private func linkKingSoopers() async {
        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let window = windowScene.keyWindow else {
            errorMessage = "Could not find a window to present sign-in."
            return
        }
        do {
            try await authManager.linkKingSoopers(presentationAnchor: window)
            withAnimation { successMessage = "King Soopers linked!" }
        } catch {
            let msg = error.localizedDescription
            if !msg.localizedCaseInsensitiveContains("cancel") {
                errorMessage = msg
            }
        }
    }

    private func linkTodoist() async {
        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let window = windowScene.keyWindow else {
            errorMessage = "Could not find a window to present sign-in."
            return
        }
        do {
            try await authManager.linkTodoist(presentationAnchor: window)
            withAnimation { successMessage = "Todoist linked!" }
        } catch {
            let msg = error.localizedDescription
            if !msg.localizedCaseInsensitiveContains("cancel") {
                errorMessage = msg
            }
        }
    }

    private func loadTodoistProjects() async {
        isLoadingProjects = true
        defer { isLoadingProjects = false }

        struct ProjectsResponse: Decodable {
            let success: Bool?
            let projects: [TodoistProject]
        }
        do {
            let response: ProjectsResponse = try await APIClient.shared.get("/api/todoist/projects")
            todoistProjects = response.projects
            // Pre-select current project
            if selectedProjectName.isEmpty {
                selectedProjectName = todoistProjectName.isEmpty ? "groceries" : todoistProjectName
            }
        } catch {
            // Fall back to manual text field
            todoistProjects = []
        }
    }
}

// MARK: - Supporting Types

/// Decoded store location from GET /api/kroger/locations
private struct KrogerLocation: Decodable, Identifiable {
    let locationId: String
    let name: String
    let address: String
    let city: String
    let state: String
    let zipCode: String

    var id: String { locationId }

    var displayName: String { "\(name) – \(city), \(state)" }
    var addressLine: String { address.isEmpty ? "\(city), \(state) \(zipCode)" : "\(address), \(city), \(state) \(zipCode)" }

    enum CodingKeys: String, CodingKey {
        case locationId, name, address, city, state, zipCode
    }
}

/// Decoded Todoist project from GET /api/todoist/projects
private struct TodoistProject: Decodable, Identifiable {
    let id: String
    let name: String
    let color: String?
    let isFavorite: Bool?
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

