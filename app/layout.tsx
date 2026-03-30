import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Grocery Optimizer",
  description: "Compare King Soopers vs Amazon prices. Add items, compare prices, pick winners, push to cart.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
