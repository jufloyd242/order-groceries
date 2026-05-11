import XCTest

final class SmartGroceryOptimizerUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testAppLaunches() throws {
        let app = XCUIApplication()
        app.launch()
    }
}
