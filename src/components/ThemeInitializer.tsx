"use client";

import { useEffect } from "react";

export const THEME_STORAGE_KEY = "propiafinance:theme";
export type AppTheme = "dark" | "light";

export function applyAppTheme(theme: AppTheme) {
  document.body.dataset.theme = theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export function saveAppTheme(theme: AppTheme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyAppTheme(theme);
}

export function ThemeInitializer() {
  useEffect(() => {
    applyAppTheme(getStoredTheme());
  }, []);

  return null;
}
