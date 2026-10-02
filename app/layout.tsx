import { cookies } from "next/headers";
import { ThemeToggle } from "./components/theme-toggle";
import "./theme.css";
import { demoEnabled } from "@/lib/demo";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stockify",
  description: "Inventaire Shopify indépendant",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = (await cookies()).get("stockify_theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="fr" data-theme={theme}>
      <body>
        {demoEnabled() && (
          <div className="demo-banner">
            DÉMONSTRATION LOCALE — Données fictives. Aucun stock Shopify réel
            n’est modifié.
          </div>
        )}
        {children}
        <ThemeToggle initialTheme={theme} />
      </body>
    </html>
  );
}
