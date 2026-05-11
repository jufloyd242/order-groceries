import Foundation

// MARK: - JSON Decoder Configuration
// Supabase returns ISO8601 timestamps (e.g. "2026-05-10T14:30:00.000Z")
// Configure a shared decoder that all API calls use.

extension JSONDecoder {
    /// Pre-configured decoder for all SGO API responses
    static let sgo: JSONDecoder = {
        let decoder = JSONDecoder()

        // Handle ISO8601 dates with fractional seconds (Supabase format)
        let iso8601 = ISO8601DateFormatter()
        iso8601.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let iso8601NoFrac = ISO8601DateFormatter()
        iso8601NoFrac.formatOptions = [.withInternetDateTime]

        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)

            if let date = iso8601.date(from: string) {
                return date
            }
            if let date = iso8601NoFrac.date(from: string) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(string)"
            )
        }

        return decoder
    }()
}
