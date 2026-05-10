import XCTest
@testable import SmartGroceryOptimizer

final class ComparisonTests: XCTestCase {

    func testDecodeComparisonResult() throws {
        let json = """
        {
            "item": {
                "id": "item-1",
                "raw_text": "milk",
                "normalized_text": "milk",
                "quantity": 1,
                "unit": null,
                "source": "manual",
                "todoist_task_id": null,
                "preference_id": null,
                "status": "compared",
                "created_at": "2026-05-10T14:30:00.000Z",
                "purchased_at": null,
                "persistent": false,
                "department": "Dairy"
            },
            "kroger": [{
                "id": "kr-1",
                "name": "Kroger Whole Milk",
                "brand": "Kroger",
                "price": 3.49,
                "promo_price": null,
                "size": "1 gal",
                "unit": "gal",
                "price_per_unit": 3.49,
                "image_url": null,
                "store": "kroger",
                "upc": "0001111042118",
                "match_score": 90
            }],
            "amazon": [{
                "id": "az-1",
                "name": "Amazon Whole Milk",
                "brand": "365",
                "price": 4.99,
                "promo_price": null,
                "size": "1 gal",
                "unit": "gal",
                "price_per_unit": 4.99,
                "image_url": null,
                "store": "amazon",
                "asin": "B08N5WRWNW",
                "match_score": 85
            }],
            "selected_kroger": {
                "id": "kr-1",
                "name": "Kroger Whole Milk",
                "brand": "Kroger",
                "price": 3.49,
                "promo_price": null,
                "size": "1 gal",
                "unit": "gal",
                "price_per_unit": 3.49,
                "image_url": null,
                "store": "kroger",
                "upc": "0001111042118",
                "match_score": 90
            },
            "selected_amazon": {
                "id": "az-1",
                "name": "Amazon Whole Milk",
                "brand": "365",
                "price": 4.99,
                "promo_price": null,
                "size": "1 gal",
                "unit": "gal",
                "price_per_unit": 4.99,
                "image_url": null,
                "store": "amazon",
                "asin": "B08N5WRWNW",
                "match_score": 85
            },
            "winner": "kroger",
            "savings": 1.50,
            "ppu_winner": "kroger",
            "savings_note": "$0.027/fl oz vs $0.039/fl oz",
            "price_per_unit": {
                "kroger": 0.027,
                "amazon": 0.039,
                "unit": "fl oz"
            }
        }
        """.data(using: .utf8)!

        let result = try JSONDecoder.sgo.decode(ComparisonResult.self, from: json)

        XCTAssertEqual(result.item.id, "item-1")
        XCTAssertEqual(result.item.status, .compared)
        XCTAssertEqual(result.kroger.count, 1)
        XCTAssertEqual(result.amazon.count, 1)
        XCTAssertEqual(result.selectedKroger?.id, "kr-1")
        XCTAssertEqual(result.selectedAmazon?.id, "az-1")
        XCTAssertEqual(result.winner, .kroger)
        XCTAssertEqual(result.savings, 1.50)
        XCTAssertEqual(result.ppuWinner, .kroger)
        XCTAssertEqual(result.savingsNote, "$0.027/fl oz vs $0.039/fl oz")
        XCTAssertEqual(result.pricePerUnit.kroger, 0.027)
        XCTAssertEqual(result.pricePerUnit.amazon, 0.039)
        XCTAssertEqual(result.pricePerUnit.unit, "fl oz")
    }

    func testDecodeComparisonSummary() throws {
        let json = """
        {
            "totalItems": 8,
            "krogerWins": 5,
            "amazonWins": 2,
            "ties": 1,
            "totalSavings": 12.47,
            "krogerCartTotal": 45.90,
            "amazonCartTotal": 58.37,
            "unmappedCount": 3
        }
        """.data(using: .utf8)!

        let summary = try JSONDecoder.sgo.decode(ComparisonSummary.self, from: json)

        XCTAssertEqual(summary.totalItems, 8)
        XCTAssertEqual(summary.krogerWins, 5)
        XCTAssertEqual(summary.amazonWins, 2)
        XCTAssertEqual(summary.ties, 1)
        XCTAssertEqual(summary.totalSavings, 12.47)
        XCTAssertEqual(summary.krogerCartTotal, 45.90)
        XCTAssertEqual(summary.amazonCartTotal, 58.37)
        XCTAssertEqual(summary.unmappedCount, 3)
    }

    func testDecodeTieResult() throws {
        let json = """
        {
            "item": {
                "id": "item-tie",
                "raw_text": "bread",
                "normalized_text": "bread",
                "quantity": 1,
                "unit": null,
                "source": "manual",
                "todoist_task_id": null,
                "preference_id": null,
                "status": "compared",
                "created_at": "2026-05-10T14:30:00.000Z",
                "department": null
            },
            "kroger": [],
            "amazon": [],
            "selected_kroger": null,
            "selected_amazon": null,
            "winner": "tie",
            "savings": 0,
            "price_per_unit": {
                "kroger": null,
                "amazon": null,
                "unit": "each"
            }
        }
        """.data(using: .utf8)!

        let result = try JSONDecoder.sgo.decode(ComparisonResult.self, from: json)

        XCTAssertEqual(result.winner, .tie)
        XCTAssertEqual(result.savings, 0)
        XCTAssertNil(result.selectedKroger)
        XCTAssertNil(result.selectedAmazon)
        XCTAssertNil(result.ppuWinner)
        XCTAssertNil(result.pricePerUnit.kroger)
    }
}
