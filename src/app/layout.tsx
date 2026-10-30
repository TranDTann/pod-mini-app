import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./app.css";
import { LIBRARY_FONTS } from "@/sections/pod-editor/elements/library";

// Display fonts for the element library's text presets. Loaded as plain CSS families
// (not next/font) because Fabric draws text on a canvas by font-family name.
const LIBRARY_FONTS_URL = `https://fonts.googleapis.com/css2?${LIBRARY_FONTS.map(
  (f) => `family=${f.replaceAll(" ", "+")}${["Oswald", "Playfair Display", "Caveat"].includes(f) ? ":wght@400;700" : ""}`,
).join("&")}&display=swap`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "POD Design Editor",
  description: "Print-on-demand design editor",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Plain font families, so the canvas can use them by name */}
        <link rel="stylesheet" href={LIBRARY_FONTS_URL} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
