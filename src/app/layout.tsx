import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MRL Gestão",
  description: "Sistema operacional simples para uso pessoal do Murilo",
  icons: {
    icon: "/favicon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
