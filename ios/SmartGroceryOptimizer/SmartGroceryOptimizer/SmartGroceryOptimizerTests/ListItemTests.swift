import XCTest
@testable import SmartGroceryOptimizer

final class ListItemTests: XCTestCase {

    func testDecodeListItem() throws {
        let json = """
        {
            "id": "abc-123",
            "raw_text": "2 gallons milk",
            "normalized_text": "milk",
            "quantity": 2,
            "unit": "gallon",
            "source": "manual",
            "todoist_task_id": null,
            "preference_id": "pref-456",
            "status": "pending",
            "created_at": "2026-05-10T14:30:00.000Z",
            "purchased_at": null,
            "persistent": false,
            "department": "Dairy"
        }
        """.data(using: .utf8)!

        let item = try JSONDecoder.sgo.decode(ListItem.self, from: json)

        XCTAssertEqual(item.id, "abc-123")
        XCTAssertEqual(item.rawText, "2 gallons milk")
        XCTAssertEqual(item.normalizedText, "milk")
        XCTAssertEqual(item.quantity, 2)
        XCTAssertEqual(item.unit, "gallon")
        XCTAssertEqual(item.source, .manual)
        XCTAssertNil(item.todoistTaskId)
        XCTAssertEqual(item.preferenceId, "pref-456")
        XCTAssertEqual(item.status, .pending)
        XCTAssertNotNil(item.createdAt)
        XCTAssertNil(item.purchasedAt)
        XCTAssertEqual(item.persistent, false)
        XCTAssertEqual(item.department, "Dairy")
    }

    func testDecodeUIListItemWithPreference() throws {
        let json = """
        {
            "id": "abc-123",
            "raw_text": "milk",
            "normalized_text": "milk",
            "quantity": 1,
            "unit": null,
            "source": "todoist",
            "todoist_task_id": "tod-789",
            "preference_id": "pref-456",
            "status": "compared",
            "created_at": "2026-05-10T14:30:00.000Z",
            "purchased_at": null,
            "persistent": true,
            "department": "Dairy",
            "preference": {
                "display_name": "Horizon Organic Whole Milk, 1 gal",
                "preferred_upc": "0001111042118",
                "preferred_asin": null,
                "image_url": "https://example.com/milk.jpg"
            }
        }
        """.data(using: .utf8)!

        let item = try JSONDecoder.sgo.decode(UIListItem.self, from: json)

        XCTAssertEqual(item.id, "abc-123")
        XCTAssertEqual(item.source, .todoist)
        XCTAssertEqual(item.todoistTaskId, "tod-789")
        XCTAssertEqual(item.status, .compared)
        XCTAssertEqual(item.persistent, true)

        let pref = try XCTUnwrap(item.preference)
        XCTAssertEqual(pref.displayName, "Horizon Organic Whole Milk, 1 gal")
        XCTAssertEqual(pref.preferredUpc, "0001111042118")
        XCTAssertNil(pref.preferredAsin)
        XCTAssertEqual(pref.imageUrl, "https://example.com/milk.jpg")
    }

    func testDecodeUIListItemWithoutPreference() throws {
        let json = """
        {
            "id": "new-item",
            "raw_text": "tp",
            "normalized_text": "toilet paper",
            "quantity": null,
            "unit": null,
            "source": "manual",
            "todoist_task_id": null,
            "preference_id": null,
            "status": "pending",
            "created_at": "2026-05-10T14:30:00Z",
            "persistent": null,
            "department": null
        }
        """.data(using: .utf8)!

        let item = try JSONDecoder.sgo.decode(UIListItem.self, from: json)

        XCTAssertEqual(item.id, "new-item")
        XCTAssertNil(item.preference)
        XCTAssertNil(item.purchasedAt)
        XCTAssertNil(item.persistent)
    }

    func testDecodePurchasedItem() throws {
        let json = """
        {
            "id": "done-1",
            "raw_text": "eggs",
            "normalized_text": "eggs",
            "quantity": 1,
            "unit": "dozen",
            "source": "manual",
            "todoist_task_id": null,
            "preference_id": null,
            "status": "purchased",
            "created_at": "2026-05-01T10:00:00.000Z",
            "purchased_at": "2026-05-09T18:45:00.000Z",
            "persistent": true,
            "department": "Dairy"
        }
        """.data(using: .utf8)!

        let item = try JSONDecoder.sgo.decode(ListItem.self, from: json)

        XCTAssertEqual(item.status, .purchased)
        XCTAssertNotNil(item.purchasedAt)
    }

    func testEncodeNewListItem() throws {
        let newItem = NewListItem(rawText: "bananas", source: .manual)
        let data = try JSONEncoder().encode(newItem)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(dict["raw_text"] as? String, "bananas")
        XCTAssertEqual(dict["source"] as? String, "manual")
        XCTAssertNil(dict["todoist_task_id"])
    }
}
