import { demoEnabled } from "@/lib/demo";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stockify",
  description: "Inventaire Shopify indépendant",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        {demoEnabled() && (
          <div className="demo-banner">
            DÉMONSTRATION LOCALE — Données fictives. Aucun stock Shopify réel
            n’est modifié.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
