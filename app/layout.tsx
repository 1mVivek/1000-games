import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "1000 Games — Water Sorter",
  description: "Game #1 of the 1000 Games collection.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
