import { Studio } from "@/components/Studio";
import { FAQ, NETWORK_LINKS, SITE } from "@/lib/site";

const FEATURES: Array<{ icon: string; title: string; text: string; color: string }> = [
  { icon: "🧑‍🤝‍🧑", title: "13 ready characters", text: "Kids, friends, Amma, Appa, Paati, Thatha, a teacher, a boss and a doctor — each with their own look and voice. Any name in your script gets one.", color: "var(--yellow)" },
  { icon: "👄", title: "Real lip sync", text: "Mouths open and change shape with the actual sound of the voice, sixty times a second — in any language.", color: "var(--pink)" },
  { icon: "🗣️", title: "Tamil · Telugu · Hindi · English", text: "Plus Tanglish and Hinglish: a Tamil or Hindi voice with subtitles in English letters. 30 natural Gemini voices.", color: "var(--mint-soft)" },
  { icon: "💬", title: "Word-by-word subtitles", text: "Four styles that light up each word as it is spoken, in the right font for every script. Also saved as an .srt file.", color: "var(--violet-soft)" },
  { icon: "🏞️", title: "16 backgrounds", text: "Classroom, kitchen, tea shop, park, office, beach and more. Change the place mid-video with one line in the script.", color: "var(--sky)" },
  { icon: "🎭", title: "Acting, automatically", text: "Moods, gestures, who looks at whom, a camera push on the punch line, a facepalm from the listener and floating laughs.", color: "var(--yellow)" },
  { icon: "✨", title: "AI script writer", text: "Stuck? Give a topic and Gemini writes the dialogue in your language — and the YouTube title, description and tags after.", color: "var(--pink)" },
  { icon: "🎵", title: "Music & sound effects", text: "Three music moods and comedy sound effects, made by the site itself — nothing to license, no copyright claims.", color: "var(--mint-soft)" },
  { icon: "🎬", title: "MP4 up to 4K, no watermark", text: "9:16 for Shorts and Reels, 16:9 for YouTube, 1:1 for posts. Encoded inside your browser, faster than real time.", color: "var(--violet-soft)" },
];

const STEPS: Array<{ title: string; text: string }> = [
  { title: "Write the script", text: "One line per turn — Meena: Hello! Add a mood in brackets if you like, or let the AI write it from a topic." },
  { title: "Pick cast and scene", text: "Choose who plays each name, their voice, the background, the subtitle style and the music." },
  { title: "Paste your Gemini key", text: "Free from Google AI Studio. It stays in your browser and is used only to record the voices." },
  { title: "Make and download", text: "Press the red button. The voices are recorded, the mouths are synced and your MP4 is ready." },
];

export default function Home() {
  return (
    <>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--paper)", borderBottom: "3px solid var(--ink)" }}>
        <div className="wrap flex items-center gap-3" style={{ minHeight: 64 }}>
          <a href="#top" className="display flex items-center gap-2 text-xl sm:text-2xl" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
            <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: 40, height: 40, borderRadius: 12, border: "3px solid var(--ink)", background: "var(--coral)", boxShadow: "var(--shadow-sm)", fontSize: 20 }}>🎬</span>
            {SITE.name}
          </a>
          <span className="grow" />
          <nav className="hidden items-center gap-5 sm:flex" aria-label="Sections" style={{ fontWeight: 800 }}>
            <a href="#features" style={{ textDecoration: "none" }}>Features</a>
            <a href="#how" style={{ textDecoration: "none" }}>How it works</a>
            <a href="#faq" style={{ textDecoration: "none" }}>FAQ</a>
          </nav>
          <a href="#studio" className="btn btn-yellow" style={{ minHeight: 40, whiteSpace: "nowrap", padding: "6px 14px" }}>Make a video</a>
        </div>
      </header>

      <main id="top">
        <section className="wrap" style={{ paddingTop: 44, paddingBottom: 28, textAlign: "center" }}>
          <span className="burst">Free · No sign-up · No watermark</span>
          <h1 className="mx-auto mt-5" style={{ fontSize: "clamp(2.3rem, 6.2vw, 4.4rem)", maxWidth: 900 }}>
            Type a script. Get a <span className="mark">talking cartoon</span> video.
          </h1>
          <p className="mx-auto mt-4" style={{ maxWidth: 680, fontSize: "1.15rem", fontWeight: 600, color: "var(--muted)" }}>
            13 characters, real lip sync, voices and subtitles in Tamil, Telugu, Hindi and English. Made in your browser with your own free Gemini API key.
          </p>
        </section>

        <section id="studio" className="wrap" style={{ paddingBottom: 56 }} aria-label="Video studio">
          <Studio />
        </section>

        <section id="features" style={{ background: "var(--ink)", color: "#fff", padding: "56px 0" }}>
          <div className="wrap">
            <h2 style={{ fontSize: "clamp(1.9rem, 4.4vw, 3rem)", textAlign: "center" }}>Everything is set up already</h2>
            <p className="mx-auto mt-2 text-center" style={{ maxWidth: 620, opacity: 0.8, fontWeight: 600 }}>No timeline, no keyframes, no editing skills. The script is the whole job.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <article key={f.title} style={{ background: f.color, color: "var(--ink)", border: "3px solid #fff", borderRadius: 20, padding: 20 }}>
                  <div aria-hidden="true" style={{ fontSize: 34, lineHeight: 1 }}>{f.icon}</div>
                  <h3 className="mt-3 text-xl">{f.title}</h3>
                  <p className="mt-1" style={{ fontWeight: 600 }}>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="wrap" style={{ padding: "56px 16px" }}>
          <h2 style={{ fontSize: "clamp(1.9rem, 4.4vw, 3rem)", textAlign: "center" }}>How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ listStyle: "none", padding: 0 }}>
            {STEPS.map((s, i) => (
              <li key={s.title} className="card p-5">
                <span className="step">{i + 1}</span>
                <h3 className="mt-3 text-xl">{s.title}</h3>
                <p className="mt-1" style={{ fontWeight: 600, color: "var(--muted)" }}>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" className="wrap" style={{ paddingBottom: 64, maxWidth: 860 }}>
          <h2 style={{ fontSize: "clamp(1.9rem, 4.4vw, 3rem)", textAlign: "center" }}>Questions</h2>
          <div className="mt-8 grid gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="card" style={{ padding: "14px 18px" }}>
                <summary className="display text-lg">{f.q}</summary>
                <p className="mt-2" style={{ fontWeight: 600, color: "var(--muted)" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer style={{ borderTop: "3px solid var(--ink)", background: "var(--paper-2)", padding: "36px 0 28px" }}>
        <div className="wrap">
          <nav aria-label="CodeLove network">
            <h2 className="text-lg">CodeLove network</h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-5" style={{ listStyle: "none", padding: 0, margin: 0, fontWeight: 700 }}>
              {NETWORK_LINKS.map((l) => (
                <li key={l.href}><a href={l.href} title={l.title}>{l.label}</a></li>
              ))}
            </ul>
          </nav>
          <p className="mt-6" style={{ fontWeight: 600, color: "var(--muted)" }}>
            Built with ♥ by <a href={SITE.creatorUrl}>{SITE.creator}</a> · <a href={SITE.brandUrl}>{SITE.brand}</a> · <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            {" · "}<a href="https://codelove.in/legal/privacy">Privacy</a> · <a href="https://codelove.in/legal/terms">Terms</a>
          </p>
          <p className="hint mt-2">Voices by Google Gemini, with your own API key. {SITE.name} is not affiliated with Google.</p>
        </div>
      </footer>
    </>
  );
}
