import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioCare Quarantine & Treatment Facility",
  description: "Virus Quarantine & Treatment Facility Management Portal - 74 Bed Capacity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
