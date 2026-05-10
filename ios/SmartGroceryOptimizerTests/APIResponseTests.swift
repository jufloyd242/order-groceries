import XCTest
@testable import SmartGroceryOptimizer

final class APIResponseTests: XCTestCase {

    func testDecodeListResponse() throws {
        let json = """
        {
            "success": true,
            "count": 2,
            "items": [
                {
                    "id": "item-1",
                    "raw_text": "milk",
                    "normalized_text": "milk",
                    "quantity": 1,
                    "unit": null,
                    "source": "manual",
                    "todoist_task_id": null,
                    "preference_id": null,
                    "status": "pending",
                    "created_at": "2026-05-10T14:30:00.000Z",
                    "department": null
                },
                {
                    "id": "item-2",
                    "raw_text": "eggs",
                    "normalized_text": "eggs",
                    "quantity": 1,
                    "unit": "dozen",
                    "source": "todoist",
                    "todoist_task_id": "tod-123",
                    "preference_id": null,
                    "status": "pending",
                    "created_at": "2026-05-10T14:31:00.000Z",
                    "persistent": true,
                    "department": "Dairy"
                }
            ]
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder.sgo.decode(APIResponse<ListResponse>.self, from: json)

        XCTAssertTrue(response.success)
        XCTAssertNil(response.error)

        let payload = try XCTUnwrap(response.data)
        XCTAssertEqual(payload.count, 2)
        XCTAssertEqual(payload.items.count, 2)
        XCTAssertEqual(payload.items[0].rawText, "milk")
        XCTAssertEqual(payload.items[1].source, .todoist)
    }

    func testDecodeSettingsResponse() throws {
        let json = """
        {
            "success": true,
            "settings": {
                "default_zip_code": "80516",
                "store_chain": "King Soopers",
                "todoist_project_name": "groceries",
                "kroger_location_id": "70400441",
                "order_modality": "PICKUP",
                "auto_remove_on_cart": "true",
                "retained_items": ""
            }
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder.sgo.decode(APIResponse<SettingsResponse>.self, from: json)

        XCTAssertTrue(response.success)
        let payload = try XCTUnwrap(response.data)
        XCTAssertEqual(payload.settings.defaultZipCode, "80516")
        XCTAssertEqual(payload.settings.orderModality, .pickup)
    }

    func testDecodeErrorResponse() throws {
        let json = """
        {
            "success": false,
            "error": "Missing required parameter: q"
        }
        """.data(using: .utf8)!

        // Even without a real payload type, we can decode the envelope
        let response = try JSONDecoder.sgo.decode(APIResponse<ListResponse>.self, from: json)

        XCTAssertFalse(response.success)
        XCTAssertEqual(response.error, "Missing required parameter: q")
    }

    func testDecodeCompareResponse() throws {
        let json = """
        {
            "success": true,
            "results": [{
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
                    "department": "Dairy"
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
            }],
            "summary": {
                "totalItems": 1,
                "krogerWins": 0,
                "amazonWins": 0,
                "ties": 1,
                "totalSavings": 0,
                "krogerCartTotal": 0,
                "amazonCartTotal": 0,
                "unmappedCount": 1
            }
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder.sgo.decode(APIResponse<CompareResponse>.self, from: json)

        XCTAssertTrue(response.success)
        let payload = try XCTUnwrap(response.data)
        XCTAssertEqual(payload.results.count, 1)
        XCTAssertEqual(payload.summary.totalItems, 1)
        XCTAssertEqual(payload.summary.ties, 1)
    }

    func testDecodeKrogerAuthStatus() throws {
        let json = """
        {
            "success": true,
            "linked": true
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder.sgo.decode(APIResponse<KrogerAuthStatusResponse>.self, from: json)

        XCTAssertTrue(response.success)
        let payload = try XCTUnwrap(response.data)
        XCTAssertTrue(payload.linked)
    }
}
