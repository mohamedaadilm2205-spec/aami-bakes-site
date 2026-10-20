import type { Metadata } from "next";
import { business } from "@/lib/business";
import "./globals.css";

const siteUrl = "https://aamibakes.co.in";
const siteTitle = "Aami Bakes | Custom Cakes in Nagercoil";
const siteDescription = "Order freshly made celebration cakes from Aami Bakes in Alur, Nagercoil. Explore our cake menu and enquire about custom designs and delivery.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  icons: { icon: [{ url: "/favicon.png", type: "image/png", sizes: "512x512" }] },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Aami Bakes",
    title: siteTitle,
    description: siteDescription,
    locale: "en_IN",
    images: [{ url: "/aami-bakes-hero-cake.jpeg", alt: "A celebration cake from Aami Bakes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/aami-bakes-hero-cake.jpeg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const bakeryStructuredData = {
    "@context": "https://schema.org",
    "@type": "Bakery",
    name: "Aami Bakes",
    url: siteUrl,
    image: `${siteUrl}/aami-bakes-hero-cake.jpeg`,
    logo: `${siteUrl}/aami-bakes-logo.png`,
    telephone: `+91 ${business.phone}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: "8/51, Thaikka Street, Aloor, Alur",
      addressLocality: "Nagercoil",
      addressRegion: "Tamil Nadu",
      postalCode: "629801",
      addressCountry: "IN",
    },
    hasMap: business.mapsUrl,
    sameAs: [business.instagram],
    servesCuisine: "Cakes and baked goods",
  };

  return <html lang="en"><body>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bakeryStructuredData).replace(/</g, "\\u003c") }} />
    {children}
  </body></html>;
}
