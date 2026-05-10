import XCTest
@testable import SmartGroceryOptimizer

final class CartTests: XCTestCase {

    func testDecodeCartItem() throws {
        let json = """
        {
            "id": "kroger-0001111042118",
            "store": "kroger",
            "name": "Horizon Organic Whole Milk",
            "brand": "Horizon",
            "price": 6.49,
            "quantity": 1,
            "image_url": "https://example.com/milk.jpg",
            "size": "1 gal",
            "upc": "0001111042118",
            "asin": null,
            "listItemId": "item-1",
            "addedAt": 1715356200000
        }
        """.data(using: .utf8)!

        let item = try JSONDecoder.sgo.decode(CartItem.self, from: json)

        XCTAssertEqual(item.id, "kroger-0001111042118")
        XCTAssertEqual(item.store, .kroger)
        XCTAssertEqual(item.name, "Horizon Organic Whole Milk")
        XCTAssertEqual(item.brand, "Horizon")
        XCTAssertEqual(item.price, 6.49)
        XCTAssertEqual(item.quantity, 1)
        XCTAssertEqual(item.imageUrl, "https://example.com/milk.jpg")
        XCTAssertEqual(item.upc, "0001111042118")
        XCTAssertNil(item.asin)
        XCTAssertEqual(item.listItemId, "item-1")

        // addedAt is JS ms timestamp
        XCTAssertEqual(item.addedAt, 1715356200000)
        XCTAssertTrue(item.addedDate < Date()) // Should be in the past
    }

    func testDecodeAmazonCartItem() throws {
        let json = """
        {
            "id": "amazon-B08N5WRWNW",
            "store": "amazon",
            "name": "365 Organic Whole Milk",
            "brand": "365",
            "price": 7.29,
            "quantity": 2,
            "image_url": null,
            "size": "1 gal",
            "asin": "B08N5WRWNW",
            "addedAt": 1715356200000
        }
        """.data(using: .utf8)!

        let item = try JSONDecoder.sgo.decode(CartItem.self, from: json)

        XCTAssertEqual(item.store, .amazon)
        XCTAssertEqual(item.asin, "B08N5WRWNW")
        XCTAssertNil(item.upc)
        XCTAssertNil(item.listItemId)
        XCTAssertEqual(item.quantity, 2)
    }

    func testDecodeStoreSubmitResult() throws {
        let json = """
        {
            "store": "kroger",
            "success": true,
            "itemsAdded": 5,
            "itemsFailed": 0,
            "errors": []
        }
        """.data(using: .utf8)!

        let result = try JSONDecoder.sgo.decode(StoreSubmitResult.self, from: json)

        XCTAssertEqual(result.store, .kroger)
        XCTAssertTrue(result.success)
        XCTAssertEqual(result.itemsAdded, 5)
        XCTAssertEqual(result.itemsFailed, 0)
        XCTAssertTrue(result.errors.isEmpty)
        XCTAssertNil(result.authUrl)
    }

    func testDecodeSubmitResultNeedsAuth() throws {
        let json = """
        {
            "store": "kroger",
            "success": false,
            "itemsAdded": 0,
            "itemsFailed": 3,
            "errors": ["Kroger authentication required"],
            "authUrl": "https://api.kroger.com/v1/connect/oauth2/authorize?client_id=xxx&scope=cart.basic:write"
        }
        """.data(using: .utf8)!

        let result = try JSONDecoder.sgo.decode(StoreSubmitResult.self, from: json)

        XCTAssertFalse(result.success)
        XCTAssertEqual(result.itemsFailed, 3)
        XCTAssertNotNil(result.authUrl)
        XCTAssertTrue(result.authUrl!.contains("oauth2"))
    }

    func testDecodeCartSubmitResult() throws {
        let json = """
        {
            "results": [
                {
                    "store": "kroger",
                    "success": true,
                    "itemsAdded": 3,
                    "itemsFailed": 0,
                    "errors": []
                }
            ],
            "submittedIds": ["kroger-001", "kroger-002", "kroger-003"]
        }
        """.data(using: .utf8)!

        let result = try JSONDecoder.sgo.decode(CartSubmitResult.self, from: json)

        XCTAssertEqual(result.results.count, 1)
        XCTAssertEqual(result.results[0].store, .kroger)
        XCTAssertEqual(result.submittedIds.count, 3)
    }
}
