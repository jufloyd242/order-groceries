import SafariServices
import SwiftUI

// MARK: - SafariView
// UIViewControllerRepresentable wrapper around SFSafariViewController.
// Used to open Amazon cart/product URLs in an in-app browser that:
//   1. Does NOT trigger iOS Universal Links (so amazon.com stays in the browser)
//   2. Shares cookies with Safari (user stays logged into Amazon)
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let vc = SFSafariViewController(url: url)
        vc.preferredControlTintColor = .systemBlue
        return vc
    }

    func updateUIViewController(_ vc: SFSafariViewController, context: Context) {}
}
