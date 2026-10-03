import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aami Bakes | Made with love",
  description: "Small-batch cakes made fresh for your special moments.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
