import XCTest
@testable import SmartGroceryOptimizer

final class ProductMatchTests: XCTestCase {

    func testDecodeKrogerProduct() throws {
        let json = """
        {
            "id": "0001111042118",
            "name": "Horizon Organic Whole Milk",
            "brand": "Horizon",
            "price": 6.49,
            "promo_price": 5.99,
            "size": "1 gal",
            "unit": "gal",
            "price_per_unit": 5.99,
            "image_url": "https://example.com/milk.jpg",
            "store": "kroger",
            "upc": "0001111042118",
            "asin": null,
            "is_prime": null,
            "match_score": 92.5,
            "ai_reasoning": null,
            "normalized_total_qty": 128,
            "normalized_qty_unit": "fl oz",
            "department": "Dairy",
            "link": "https://www.kroger.com/p/0001111042118"
        }
        """.data(using: .utf8)!

        let product = try JSONDecoder.sgo.decode(ProductMatch.self, from: json)

        XCTAssertEqual(product.id, "0001111042118")
        XCTAssertEqual(product.name, "Horizon Organic Whole Milk")
        XCTAssertEqual(product.brand, "Horizon")
        XCTAssertEqual(product.price, 6.49)
        XCTAssertEqual(product.promoPrice, 5.99)
        XCTAssertEqual(product.store, .kroger)
        XCTAssertEqual(product.upc, "0001111042118")
        XCTAssertNil(product.asin)
        XCTAssertNil(product.isPrime)
        XCTAssertEqual(product.matchScore, 92.5)
        XCTAssertEqual(product.normalizedTotalQty, 128)
        XCTAssertEqual(product.normalizedQtyUnit, "fl oz")
        XCTAssertEqual(product.department, "Dairy")
    }

    func testDecodeAmazonProduct() throws {
        let json = """
        {
            "id": "B08N5WRWNW",
            "name": "Organic Whole Milk, 1 Gallon",
            "brand": "365 by Whole Foods Market",
            "price": 7.29,
            "promo_price": null,
            "size": "1 gal",
            "unit": "gal",
            "price_per_unit": 7.29,
            "image_url": "https://m.media-amazon.com/images/I/milk.jpg",
            "store": "amazon",
            "upc": null,
            "asin": "B08N5WRWNW",
            "is_prime": true,
            "match_score": 85.0,
            "ai_reasoning": "Same product category, different brand",
            "department": null,
            "link": "https://www.amazon.com/dp/B08N5WRWNW"
        }
        """.data(using: .utf8)!

        let product = try JSONDecoder.sgo.decode(ProductMatch.self, from: json)

        XCTAssertEqual(product.store, .amazon)
        XCTAssertEqual(product.asin, "B08N5WRWNW")
        XCTAssertNil(product.upc)
        XCTAssertEqual(product.isPrime, true)
        XCTAssertEqual(product.aiReasoning, "Same product category, different brand")
        XCTAssertNil(product.department)
    }

    func testDecodeMinimalProduct() throws {
        let json = """
        {
            "id": "min-1",
            "name": "Generic Milk",
            "brand": "Store Brand",
            "price": 3.99,
            "promo_price": null,
            "size": "1 gal",
            "unit": "gal",
            "price_per_unit": 3.99,
            "image_url": null,
            "store": "kroger",
            "match_score": 70
        }
        """.data(using: .utf8)!

        let product = try JSONDecoder.sgo.decode(ProductMatch.self, from: json)

        XCTAssertEqual(product.id, "min-1")
        XCTAssertNil(product.imageUrl)
        XCTAssertNil(product.upc)
        XCTAssertNil(product.asin)
        XCTAssertNil(product.link)
    }
}
