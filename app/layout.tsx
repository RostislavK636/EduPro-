import type { Metadata } from "next";
import "./globals.css";
import "./slide-theme.css";

export const metadata: Metadata = {
  title: "EduPilot — пространство знаний",
  description:
    "Создавайте учебные материалы, планируйте занятия и учитесь вместе с EduPilot.",
  icons: {
    icon: "/edupilot.svg",
    shortcut: "/edupilot.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
