"use client";
import { createContext, useContext } from "react";
export type AppContextValue = {
  user: any;
  ai: any;
  refresh: () => Promise<void>;
  navigate: (path: string) => void;
};
export const AppContext = createContext<AppContextValue>(null as any);
export const useApp = () => useContext(AppContext);
