import XCTest
@testable import SmartGroceryOptimizer

final class AppSettingsTests: XCTestCase {

    func testDecodeAppSettings() throws {
        let json = """
        {
            "default_zip_code": "80516",
            "store_chain": "King Soopers",
            "todoist_project_name": "groceries",
            "kroger_location_id": "70400441",
            "kroger_store_name": "King Soopers #96",
            "order_modality": "PICKUP",
            "auto_remove_on_cart": "true",
            "retained_items": "milk,eggs,bread"
        }
        """.data(using: .utf8)!

        let settings = try JSONDecoder.sgo.decode(AppSettings.self, from: json)

        XCTAssertEqual(settings.defaultZipCode, "80516")
        XCTAssertEqual(settings.storeChain, "King Soopers")
        XCTAssertEqual(settings.todoistProjectName, "groceries")
        XCTAssertEqual(settings.krogerLocationId, "70400441")
        XCTAssertEqual(settings.krogerStoreName, "King Soopers #96")
        XCTAssertEqual(settings.orderModality, .pickup)
        XCTAssertEqual(settings.autoRemoveOnCart, "true")
        XCTAssertTrue(settings.shouldAutoRemoveOnCart)
        XCTAssertEqual(settings.retainedItems, "milk,eggs,bread")
    }

    func testDecodeDeliveryModality() throws {
        let json = """
        {
            "default_zip_code": "80516",
            "store_chain": "King Soopers",
            "todoist_project_name": "groceries",
            "kroger_location_id": "70400441",
            "order_modality": "DELIVERY",
            "auto_remove_on_cart": "false",
            "retained_items": ""
        }
        """.data(using: .utf8)!

        let settings = try JSONDecoder.sgo.decode(AppSettings.self, from: json)

        XCTAssertEqual(settings.orderModality, .delivery)
        XCTAssertFalse(settings.shouldAutoRemoveOnCart)
        XCTAssertNil(settings.krogerStoreName)
    }
}

final class ProductPreferenceTests: XCTestCase {

    func testDecodeProductPreference() throws {
        let json = """
        {
            "id": "pref-123",
            "generic_name": "milk",
            "display_name": "Horizon Organic Whole Milk, 1 gal",
            "preferred_upc": "0001111042118",
            "preferred_asin": null,
            "preferred_store": "kroger",
            "preferred_brand": "Horizon",
            "search_override": null,
            "last_kroger_price": 6.49,
            "last_amazon_price": null,
            "times_purchased": 5,
            "created_at": "2026-04-01T10:00:00.000Z",
            "updated_at": "2026-05-09T18:45:00.000Z"
        }
        """.data(using: .utf8)!

        let pref = try JSONDecoder.sgo.decode(ProductPreference.self, from: json)

        XCTAssertEqual(pref.id, "pref-123")
        XCTAssertEqual(pref.genericName, "milk")
        XCTAssertEqual(pref.displayName, "Horizon Organic Whole Milk, 1 gal")
        XCTAssertEqual(pref.preferredUpc, "0001111042118")
        XCTAssertNil(pref.preferredAsin)
        XCTAssertEqual(pref.preferredStore, .kroger)
        XCTAssertEqual(pref.preferredBrand, "Horizon")
        XCTAssertNil(pref.searchOverride)
        XCTAssertEqual(pref.lastKrogerPrice, 6.49)
        XCTAssertNil(pref.lastAmazonPrice)
        XCTAssertEqual(pref.timesPurchased, 5)
        XCTAssertNotNil(pref.createdAt)
        XCTAssertNotNil(pref.updatedAt)
    }

    func testDecodePreferenceNoStore() throws {
        let json = """
        {
            "id": "pref-new",
            "generic_name": "bananas",
            "display_name": "Organic Bananas",
            "preferred_upc": null,
            "preferred_asin": null,
            "preferred_store": null,
            "preferred_brand": null,
            "search_override": "organic bananas bunch",
            "last_kroger_price": null,
            "last_amazon_price": null,
            "times_purchased": 0,
            "created_at": "2026-05-10T14:30:00.000Z",
            "updated_at": "2026-05-10T14:30:00.000Z"
        }
        """.data(using: .utf8)!

        let pref = try JSONDecoder.sgo.decode(ProductPreference.self, from: json)

        XCTAssertNil(pref.preferredStore)
        XCTAssertNil(pref.preferredBrand)
        XCTAssertEqual(pref.searchOverride, "organic bananas bunch")
        XCTAssertEqual(pref.timesPurchased, 0)
    }

    func testEncodeNewProductPreference() throws {
        let newPref = NewProductPreference(
            genericName: "milk",
            displayName: "Horizon Organic Whole Milk",
            preferredUpc: "0001111042118",
            preferredStore: .kroger,
            preferredBrand: "Horizon"
        )

        let data = try JSONEncoder().encode(newPref)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(dict["generic_name"] as? String, "milk")
        XCTAssertEqual(dict["display_name"] as? String, "Horizon Organic Whole Milk")
        XCTAssertEqual(dict["preferred_upc"] as? String, "0001111042118")
        XCTAssertEqual(dict["preferred_store"] as? String, "kroger")
        XCTAssertEqual(dict["preferred_brand"] as? String, "Horizon")
        XCTAssertNil(dict["search_override"])
    }
}
