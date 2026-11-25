import "./globals.css"; // önce: cascade katman sırasını belirler

import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Hava Durumu",
  description: "Ücretsiz 7 günlük hava durumu tahmini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
