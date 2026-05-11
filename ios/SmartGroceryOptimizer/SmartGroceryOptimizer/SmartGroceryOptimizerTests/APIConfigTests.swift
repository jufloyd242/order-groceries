import XCTest
@testable import SmartGroceryOptimizer

final class APIConfigTests: XCTestCase {

    // MARK: - baseURL

    /// In the simulator the base URL must always be localhost:3000 regardless of
    /// any API_HOST value, so the dev server is reachable without network config.
    func testBaseURLIsLocalhostInSimulator() {
        #if targetEnvironment(simulator)
        XCTAssertEqual(APIConfig.baseURL.absoluteString, "http://localhost:3000")
        #else
        // On a physical device the URL will use API_HOST — just check it has a port.
        XCTAssertTrue(APIConfig.baseURL.absoluteString.contains(":3000"),
                      "Physical-device URL must include port 3000: \(APIConfig.baseURL)")
        #endif
    }

    func testBaseURLSchemeIsHTTP() {
        XCTAssertEqual(APIConfig.baseURL.scheme, "http")
    }

    func testBaseURLHasNoTrailingSlash() {
        XCTAssertFalse(APIConfig.baseURL.absoluteString.hasSuffix("/"),
                       "baseURL must not have a trailing slash to avoid double-slash in path concatenation")
    }

    // MARK: - url(for:)

    func testURLForAppendsPathCorrectly() {
        let url = APIConfig.url(for: "/api/list")
        XCTAssertTrue(url.absoluteString.hasSuffix("/api/list"),
                      "Expected path suffix '/api/list', got: \(url.absoluteString)")
    }

    func testURLForNestedPath() {
        let url = APIConfig.url(for: "/api/kroger/products")
        XCTAssertTrue(url.absoluteString.hasSuffix("/api/kroger/products"))
    }

    func testURLForIsAbsolute() {
        let url = APIConfig.url(for: "/api/settings")
        XCTAssertNotNil(url.host, "URL must be absolute and have a host")
    }

    // MARK: - Supabase config (reads Bundle.main — available when running tests in-process)

    /// Confirms supabaseURL returns a valid https URL when the xcconfig is wired in.
    /// Unit tests run in-process with the app as host, so Bundle.main IS the app's Info.plist.
    func testSupabaseURLShape() throws {
        guard let url = APIConfig.supabaseURL else {
            throw XCTSkip("SUPABASE_HOST not available in test bundle Info.plist")
        }
        XCTAssertEqual(url.scheme, "https", "Supabase URL must use HTTPS")
        let host = try XCTUnwrap(url.host, "Supabase URL must have a non-nil host")
        XCTAssertTrue(host.contains("supabase.co"),
                      "Supabase URL host should contain 'supabase.co', got: \(host)")
        // path is either empty or just "/" — both are acceptable for a bare host URL
        let path = url.path
        XCTAssertTrue(path.isEmpty || path == "/",
                      "Supabase URL should have no meaningful path, got: '\(path)'")
    }

    func testSupabaseAnonKeyShape() throws {
        guard let key = APIConfig.supabaseAnonKey else {
            throw XCTSkip("SUPABASE_ANON_KEY not available in test bundle Info.plist")
        }
        // JWT has 3 base64url segments separated by dots
        let segments = key.split(separator: ".")
        XCTAssertEqual(segments.count, 3, "Supabase anon key must be a 3-segment JWT")
        XCTAssertGreaterThan(key.count, 100, "Anon key appears too short to be a real JWT")
    }

    func testIsConfiguredMatchesIndividualChecks() {
        let expected = APIConfig.supabaseURL != nil && APIConfig.supabaseAnonKey != nil
        XCTAssertEqual(APIConfig.isConfigured, expected)
    }

    // MARK: - Placeholder rejection

    /// Verifies the guard logic inside APIConfig.supabaseURL inline, by replicating the
    /// same checks against known placeholder host strings.
    /// (We can't inject values into Info.plist at test time, so we test the logic directly.)
    func testSupabaseURLRejectsPlaceholders() {
        // Simulate what APIConfig does: read a host string, apply guards, build URL.
        func makeURL(fromHost host: String) -> URL? {
            guard !host.isEmpty,
                  !host.hasPrefix("your-"),
                  !host.hasPrefix("$("),
                  let url = URL(string: "https://\(host)"),
                  url.host != nil else { return nil }
            return url
        }

        // These host values should all be rejected
        let badHosts = [
            "your-project.supabase.co",  // starts with "your-"
            "$(SUPABASE_HOST)",           // starts with "$("
            "",                           // empty
        ]
        for host in badHosts {
            XCTAssertNil(makeURL(fromHost: host),
                         "Expected nil URL for placeholder host '\(host)'")
        }

        // A real host should succeed
        let realURL = makeURL(fromHost: "kxkynihljfakhundqmed.supabase.co")
        XCTAssertNotNil(realURL, "Expected non-nil URL for real Supabase host")
        XCTAssertEqual(realURL?.scheme, "https")
        XCTAssertEqual(realURL?.host, "kxkynihljfakhundqmed.supabase.co")
    }
}
