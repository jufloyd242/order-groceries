import Foundation

// MARK: - API Configuration
// Handles base URL selection: simulator uses localhost, physical device uses local IP.

enum APIConfig {
    /// The base URL for all API requests to the Next.js backend
    static var baseURL: URL {
        #if targetEnvironment(simulator)
        return URL(string: "http://localhost:3000")!
        #else
        // Physical device — local dev OR production Cloud Run.
        // Priority: runtime UserDefaults override → Info.plist (from SGO.xcconfig) → hardcoded fallback
        let host: String
        if let override = UserDefaults.standard.string(forKey: "api_host"), !override.isEmpty {
            host = override
        } else if let plistHost = Bundle.main.infoDictionary?["API_HOST"] as? String, !plistHost.isEmpty {
            host = plistHost
        } else {
            host = "192.168.0.33"
        }
        // Local dev (IP address) → http://host:3000
        // Production (domain name) → https://host  (Cloud Run terminates TLS on 443)
        let isIPAddress = host.range(of: #"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"#,
                                     options: .regularExpression) != nil
        let urlString = isIPAddress ? "http://\(host):3000" : "https://\(host)"
        return URL(string: urlString)!
        #endif
    }

    /// Supabase project URL — injected from SGO.xcconfig → Info.plist at build time.
    /// The plist stores only the host (no scheme) because xcconfig treats `//` as a
    /// comment, which would strip the `https://` prefix. This getter prepends the scheme.
    /// Returns nil if the xcconfig hasn't been filled in yet.
    static var supabaseURL: URL? {
        guard let host = Bundle.main.infoDictionary?["SUPABASE_HOST"] as? String,
              !host.isEmpty,
              !host.hasPrefix("your-"),
              !host.hasPrefix("$("),
              let url = URL(string: "https://\(host)"),
              url.host != nil else {
            return nil
        }
        return url
    }

    /// Supabase anon key — injected from SGO.xcconfig → Info.plist at build time.
    /// Returns nil if the xcconfig hasn't been filled in yet.
    static var supabaseAnonKey: String? {
        guard let key = Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String,
              !key.isEmpty,
              !key.hasPrefix("your-"),
              !key.hasPrefix("$(") else {
            return nil
        }
        return key
    }

    /// True when both Supabase credentials are present and non-placeholder.
    static var isConfigured: Bool {
        supabaseURL != nil && supabaseAnonKey != nil
    }

    /// Build a full URL for an API endpoint
    /// - Parameter path: Relative path (e.g. "/api/list")
    /// - Returns: Full URL (e.g. "http://localhost:3000/api/list")
    static func url(for path: String) -> URL {
        baseURL.appendingPathComponent(path)
    }
}
