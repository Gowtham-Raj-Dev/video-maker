import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@/components/Analytics";
import { FAQ, SITE } from "@/lib/site";

export const viewport: Viewport = { themeColor: "#F6F4EF", width: "device-width", initialScale: 1 };

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.creator, url: SITE.creatorUrl }],
  creator: SITE.creator,
  publisher: SITE.brand,
  keywords: [
    "cartoon video maker", "free cartoon video maker", "ai cartoon video maker", "talking cartoon maker", "lip sync video maker",
    "script to video", "text to cartoon video", "tamil cartoon video maker", "hindi cartoon video maker", "telugu cartoon video maker",
    "youtube shorts maker", "animated shorts maker", "comedy shorts maker", "gemini tts video",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: { type: "website", url: SITE.url, siteName: SITE.name, title: SITE.title, description: SITE.description, locale: "en_IN" },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      inLanguage: "en",
      publisher: { "@id": "https://codelove.in/#organization" },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE.url}/#app`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any (web browser)",
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      creator: { "@id": "https://gowtham.codelove.in/#person" },
      featureList: ["24 cartoon characters", "Lip sync from the voice", "Tamil, Tanglish, Telugu, Hindi, Hinglish, English", "Word-by-word subtitles", "16 backgrounds", "MP4 export up to 4K", "AI script writer"],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE.url}/#faq`,
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Baloo+Tammudu+2:wght@700;800&family=Baloo+Thambi+2:wght@700;800&family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
