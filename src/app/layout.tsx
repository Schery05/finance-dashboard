import type { ReactNode } from "react";
import "./styles/globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#070A12] text-white">
        {children}
      </body>
    </html>
  );
}
