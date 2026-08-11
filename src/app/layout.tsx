import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hidden Eats",
  description: "동네 사람들이 진짜 추천하는 로컬 맛집",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      {/*
        Every screen in design.pen sits on `color-background-canvas`, not on
        `color-background-default`. Both `background-default` and
        `background-surface` resolve to neutral-50, so without the canvas a
        surface card is invisible against the page.
      */}
      <body className="flex min-h-full flex-col bg-background-canvas">
        {children}
      </body>
    </html>
  );
}
