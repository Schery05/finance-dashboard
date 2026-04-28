import type { ReactNode } from "react";
import "./styles/globals.css";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <SessionProviderWrapper>
      <body className="min-h-screen bg-[#070A12] text-white">
        {children}
      </body>
      </SessionProviderWrapper>
    </html>
  );
}
