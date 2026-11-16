import type { Metadata, Viewport } from "next";
// Baloo 2 / Thambi 2 / Tammudu 2 and Instrument Sans / Serif, self-hosted from public/fonts under their own
// names: the video renderer (src/engine/draw.ts) and the editor draw with these names, so next/font is not used.
import "./google-fonts.css";
import "./globals.css";
import { Analytics } from "@/components/Analytics";
import { SITE } from "@/lib/site";

export const viewport: Viewport = { themeColor: "#F6F4EF", width: "device-width", initialScale: 1 };

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s | ${SITE.fullName}` },
  description: SITE.description,
  applicationName: SITE.fullName,
  authors: [{ name: SITE.creator, url: SITE.creatorUrl }],
  creator: SITE.creator,
  publisher: SITE.brand,
  category: "multimedia",
  keywords: [
    "free video maker", "ai video maker", "free ai video maker", "ai video maker free", "free video making online", "online video maker free",
    "codelove", "codelove video maker", "video maker no watermark", "ai video generator free", "text to video ai free", "script to video",
    "cartoon video maker", "free cartoon video maker", "ai cartoon video maker", "talking cartoon maker", "lip sync video maker",
    "text video maker", "subtitle video maker", "youtube shorts maker", "reels video maker", "animated shorts maker",
    "tamil video maker", "tamil cartoon video maker", "hindi cartoon video maker", "telugu cartoon video maker", "ai voice video maker",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: {
    type: "website",
    url: SITE.url,
    siteName: SITE.fullName,
    title: SITE.title,
    description: SITE.description,
    locale: "en_IN",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "CodeLove Video Maker — free AI video maker: script to talking cartoon video" }],
  },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description, images: ["/og.png"] },
};

const PERSON_ID = "https://gowtham.codelove.in/#person";
const ORG_ID = "https://codelove.in/#organization";

// Site-wide graph. The FAQPage lives on the home page only (src/app/page.tsx), where the questions are visible.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": PERSON_ID,
      name: SITE.creator,
      alternateName: ["Gowthamraj", "Gowtham Raj"],
      url: "https://gowtham.codelove.in",
    },
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: SITE.brand,
      url: "https://codelove.in",
      founder: { "@id": PERSON_ID },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: `${SITE.url}/`,
      name: SITE.fullName,
      alternateName: ["Video Maker by CodeLove", "Free AI Video Maker"],
      description: SITE.longDescription,
      inLanguage: "en",
      creator: { "@id": PERSON_ID },
      publisher: { "@id": ORG_ID },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE.url}/#app`,
      name: SITE.fullName,
      alternateName: "Free AI Video Maker",
      url: `${SITE.url}/editor/`,
      description: SITE.longDescription,
      image: `${SITE.url}/og.png`,
      applicationCategory: "MultimediaApplication",
      applicationSubCategory: "Video editor",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires a modern browser (Chrome, Edge, Firefox or Safari)",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      creator: { "@id": PERSON_ID },
      publisher: { "@id": ORG_ID },
      isPartOf: { "@id": `${SITE.url}/#website` },
      featureList: [
        "Script to video with AI voices", "66 cartoon characters in two styles", "Lip sync from the real voice", "Text-only videos with big captions",
        "Tamil, Tanglish, Telugu, Hindi, Hinglish, English", "Word-by-word subtitles and .srt export", "Background music and sound effects",
        "17 backgrounds or your own picture", "MP4 export up to 4K, 30 or 60 fps", "AI script, title and tag writer", "No watermark, no sign-up",
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inside UTubeFlow, its dark theme from the first paint (the frame address says which). */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(window.parent!==window&&/[?&]embed=utubeflow/.test(location.search)&&/[?&]theme=dark/.test(location.search))document.documentElement.dataset.theme="dark"}catch(e){}` }} />
        {/* The hero's font (Instrument Sans, Latin): fetch it with the HTML. */}
        <link rel="preload" href="/fonts/instrument-sans-400-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {/* CodeLove Analytics (admin.codelove.in) */}
        <script defer src="https://admin.codelove.in/t.js" />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
