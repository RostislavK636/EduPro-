"use client";
import { createContext, useEffect, ReactNode } from "react";
export const ThemeContext = createContext("dark");
export function ThemeProvider({
  theme,
  children,
}: {
  theme: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}
