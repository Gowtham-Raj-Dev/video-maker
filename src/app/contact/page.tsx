import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, Lightbulb, Bug } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE } from "@/lib/site";

const WHATSAPP = "https://wa.me/916369494396";

export const metadata: Metadata = {
  title: "Contact — Feedback, Bugs & Feature Requests",
  description: "Contact the maker of CodeLove Video Maker on WhatsApp or email: questions, bug reports, feature requests and new character ideas.",
  alternates: { canonical: "/contact/" },
};

const WAYS: Array<{ icon: typeof Mail; title: string; text: string; href: string; label: string; external?: boolean }> = [
  { icon: MessageCircle, title: "Chat on WhatsApp", text: "The quickest way to reach me. Questions about the editor, voices or exports.", href: WHATSAPP, label: "Open WhatsApp", external: true },
  { icon: Mail, title: "Email", text: "For longer messages, partnerships or anything you'd rather write down.", href: `mailto:${SITE.email}`, label: SITE.email },
  { icon: Bug, title: "Report a bug", text: "Tell me what you did, what you expected and what happened. A screenshot helps.", href: `${WHATSAPP}?text=${encodeURIComponent("Bug in Video Maker: ")}`, label: "Report on WhatsApp", external: true },
  { icon: Lightbulb, title: "Request a feature or character", text: "New characters, languages, backgrounds or tools — say what you'd use.", href: `${WHATSAPP}?text=${encodeURIComponent("Feature request for Video Maker: ")}`, label: "Send an idea", external: true },
];

export default function ContactPage() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-row">
          <Link href="/" className="brand">
            <Logo size={28} />
            {SITE.name}
          </Link>
          <nav className="nav-links" aria-label="Sections">
            <Link href="/#how">How it works</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>
          <Link href="/editor/" className="btn btn-primary">Open editor</Link>
        </div>
      </header>

      <main>
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h1 className="section-title">Contact</h1>
              <p className="section-sub">
                Video Maker is built and run by {SITE.creator}, a solo developer at {SITE.brand}. Questions, bugs and ideas all reach me directly.
              </p>
            </div>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
              {WAYS.map(({ icon: Icon, title, text, href, label, external }) => (
                <div key={title} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                  <Icon size={22} aria-hidden="true" />
                  <h2 style={{ fontSize: 17, margin: 0 }}>{title}</h2>
                  <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55, flex: 1 }}>{text}</p>
                  <a className="btn" href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{label}</a>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 24, color: "var(--muted)" }}>
              More about CodeLove: <a href="https://codelove.in/about">About</a> · <a href="https://codelove.in/legal/privacy">Privacy policy</a> · <a href="https://codelove.in/legal/terms">Terms of service</a>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
