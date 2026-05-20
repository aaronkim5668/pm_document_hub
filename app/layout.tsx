import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PM Document Hub",
  description: "Week 1 AI Import to PatchNote vertical slice",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <main className="shell">
          <header className="topbar">
            <Link href="/" style={{ fontWeight: 700, textDecoration: "none" }}>
              PM Document Hub
            </Link>
            <nav className="nav" aria-label="Primary">
              <Link href="/import">AI Import</Link>
              <Link href="/patch-notes/new">PatchNote</Link>
              <Link href="/review">Review</Link>
              <Link href="/settings">Settings</Link>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
