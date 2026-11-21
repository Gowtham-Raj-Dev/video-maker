import { ArrowUpRight, Mail } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NETWORK_LINKS, SITE } from "@/lib/site";

const WHATSAPP = "https://wa.me/916369494396";

const PRODUCT: Array<{ label: string; href: string }> = [
  { label: "Open the editor", href: "/editor/" },
  { label: "Cartoon video maker", href: "/#make" },
  { label: "Characters", href: "/#cast" },
  { label: "Works with UTubeFlow", href: "/#utubeflow" },
  { label: "Languages", href: "/#languages" },
  { label: "How it works", href: "/#how" },
  { label: "FAQ", href: "/#faq" },
];

/** Every CodeLove platform: the standard network list, plus the maker's portfolio and the apps store. */
const PLATFORMS: Array<{ label: string; href: string; title: string }> = [
  ...NETWORK_LINKS,
  { label: "CodeLove Apps", href: "https://apps.codelove.in", title: "CodeLove apps for Android" },
  { label: "Gowtham Portfolio", href: SITE.creatorUrl, title: "The developer behind CodeLove" },
];

const COMPANY: Array<{ label: string; href: string }> = [
  { label: "About CodeLove", href: "https://codelove.in/about" },
  { label: "About the maker", href: SITE.creatorUrl },
  { label: "Privacy policy", href: "https://codelove.in/legal/privacy" },
  { label: "Terms of service", href: "https://codelove.in/legal/terms" },
];

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-top">
          <div className="foot-brand">
            <Link href="/" className="brand">
              <Logo size={30} />
              {SITE.name}
            </Link>
            <p>Type a script and get a talking cartoon video — characters, voices, lip sync and captions in Tamil, Telugu, Hindi and English.</p>
            <div className="foot-actions">
              <a className="btn btn-wa" href={WHATSAPP} target="_blank" rel="noopener noreferrer"><WhatsAppIcon /> Chat on WhatsApp</a>
              <a className="btn" href={`mailto:${SITE.email}`}><Mail size={16} /> {SITE.email}</a>
            </div>
          </div>
          <a className="foot-flow" href="https://utubeflow.codelove.in" target="_blank" rel="noopener noreferrer">
            <span className="foot-flow-tag">Works with</span>
            <b>UTubeFlow <ArrowUpRight size={16} /></b>
            <span>Send your videos straight to UTubeFlow and schedule them on YouTube — free.</span>
          </a>
        </div>

        <div className="foot-grid">
          <nav aria-label="Product">
            <h2>Video Maker</h2>
            <ul>{PRODUCT.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}</ul>
          </nav>
          <nav aria-label="CodeLove platforms" className="foot-platforms">
            <h2>CodeLove platforms</h2>
            <ul>{PLATFORMS.map((l) => <li key={l.href}><a href={l.href} title={l.title}>{l.label}</a></li>)}</ul>
          </nav>
          <nav aria-label="Company">
            <h2>Company</h2>
            <ul>{COMPANY.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}</ul>
          </nav>
          <nav aria-label="Contact">
            <h2>Contact</h2>
            <ul>
              <li><Link href="/contact/">Contact page</Link></li>
              <li><a href={WHATSAPP} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>
              <li><a href={`mailto:${SITE.email}`}>Email</a></li>
              <li><a href={`${WHATSAPP}?text=${encodeURIComponent("Feature request for Video Maker: ")}`} target="_blank" rel="noopener noreferrer">Request a feature</a></li>
              <li><a href={`${WHATSAPP}?text=${encodeURIComponent("I'd like a new character in Video Maker: ")}`} target="_blank" rel="noopener noreferrer">Suggest a character</a></li>
            </ul>
          </nav>
        </div>

        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} {SITE.brand}. Built with ♥ in India by <a href={SITE.creatorUrl}>{SITE.creator}</a>.</span>
          <span>Voices by Google Gemini with your own API key. Not affiliated with Google.</span>
        </div>
      </div>
    </footer>
  );
}
