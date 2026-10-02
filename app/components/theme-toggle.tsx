"use client";
import { useState } from "react";
export function ThemeToggle({ initialTheme }: { initialTheme: "dark" | "light" }) {
  const [theme, setTheme] = useState(initialTheme);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `stockify_theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setTheme(next);
  }
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"}>
    <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    {theme === "dark" ? "Mode clair" : "Mode sombre"}
  </button>;
}
