import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduHub",
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
};

// Light by default; a saved choice from the header toggle wins. Runs before paint so there's no flash.
// It creates the theme-color meta itself: a React-rendered one would be re-added on hydration after this script edits it.
const themeScript = `(function () {
  var dark = false;
  try { dark = localStorage.getItem('theme') === 'dark'; } catch (e) {}
  document.documentElement.classList.toggle('dark', dark);
  var meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = dark ? '#141816' : '#F6F5F0';
  document.head.appendChild(meta);
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // the theme script changes <html>'s class before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 sm:px-8">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
