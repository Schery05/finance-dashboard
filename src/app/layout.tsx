import type { ReactNode } from "react";
import "./styles/globals.css";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";
import { ThemeInitializer } from "@/components/ThemeInitializer";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#070A12] text-white">
        <SessionProviderWrapper>
          <ThemeInitializer />
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
