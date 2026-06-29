import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hunt For Me",
  description: "Local job application and outreach cockpit",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-[var(--line)] bg-white">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <Link className="text-lg font-semibold" href="/">
              Hunt For Me
            </Link>
            <div className="flex gap-4 text-sm text-[var(--muted)]">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/outreach">Outreach</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
