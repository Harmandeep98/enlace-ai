import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enlace Ai"
};

const THEME_KEY = "theme";

// Runs before paint to avoid a flash of the wrong theme — reads the stored preference,
// falling back to the OS preference on a first visit.
const noFlashScript = `
  (function () {
    var stored = localStorage.getItem("${THEME_KEY}");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
