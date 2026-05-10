import Foundation

// MARK: - API Configuration
// Handles base URL selection: simulator uses localhost, physical device uses local IP.

enum APIConfig {
    /// The base URL for all API requests to the Next.js backend
    static var baseURL: URL {
        #if targetEnvironment(simulator)
        return URL(string: "http://localhost:3000")!
        #else
        // Physical device on local network.
        // Priority: runtime UserDefaults override → Info.plist (from SGO.xcconfig) → hardcoded fallback
        let host: String
        if let override = UserDefaults.standard.string(forKey: "api_host"), !override.isEmpty {
            host = override
        } else if let plistHost = Bundle.main.infoDictionary?["API_HOST"] as? String, !plistHost.isEmpty {
            host = plistHost
        } else {
            host = "192.168.0.33"
        }
        return URL(string: "http://\(host):3000")!
        #endif
    }

    /// Supabase project URL — injected from SGO.xcconfig → Info.plist at build time
    static var supabaseURL: URL {
        guard let urlString = Bundle.main.infoDictionary?["SUPABASE_URL"] as? String,
              !urlString.isEmpty,
              let url = URL(string: urlString) else {
            fatalError("SUPABASE_URL missing from Info.plist. Copy SGO.xcconfig.example → SGO.xcconfig and fill in values.")
        }
        return url
    }

    /// Supabase anon key — injected from SGO.xcconfig → Info.plist at build time
    static var supabaseAnonKey: String {
        guard let key = Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String,
              !key.isEmpty else {
            fatalError("SUPABASE_ANON_KEY missing from Info.plist. Copy SGO.xcconfig.example → SGO.xcconfig and fill in values.")
        }
        return key
    }

    /// Build a full URL for an API endpoint
    /// - Parameter path: Relative path (e.g. "/api/list")
    /// - Returns: Full URL (e.g. "http://localhost:3000/api/list")
    static func url(for path: String) -> URL {
        baseURL.appendingPathComponent(path)
    }
}
