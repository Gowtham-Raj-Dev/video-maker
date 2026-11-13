import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { FeatureVote } from "@/components/FeatureVote";
import { Figure } from "@/components/Figure";
import { GOAL } from "@/lib/requests";
import { HeroProduct } from "@/components/HeroProduct";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { BACKGROUNDS } from "@/engine/backgrounds";
import { CHARACTERS, STYLES, VOICES } from "@/engine/characters";
import { FAQ, SITE } from "@/lib/site";

const LINES: Array<{ name: string; note: string; text: string }> = [
  { name: "Tamil", note: "Tamil voice, Tamil captions", text: "அம்மா, நான்தான் டீச்சரோட ஃபேவரிட் ஸ்டூடன்ட்!" },
  { name: "Tanglish", note: "Tamil voice, English letters", text: "Amma, naan thaan teacher-oda favourite student!" },
  { name: "Telugu", note: "Telugu voice and captions", text: "అమ్మా, నేనే టీచర్ ఫేవరెట్ స్టూడెంట్‌ని!" },
  { name: "Hindi", note: "Hindi voice and captions", text: "मम्मी, मैं टीचर की फेवरेट स्टूडेंट हूँ!" },
  { name: "Hinglish", note: "Hindi voice, English letters", text: "Mummy, main teacher ki favourite student hoon!" },
  { name: "English", note: "English voice and captions", text: "Mom, my teacher says I'm her favourite student!" },
];

const STEPS: Array<{ title: string; text: string }> = [
  { title: "Write the dialogue", text: "One line per turn, like Meena: Hello! Add a mood in brackets, or let Gemini draft it from a topic." },
  { title: "Cast it", text: "Every name gets a character and a voice. Swap either, pick a scene, captions and music." },
  { title: "Record the voices", text: "Press play. The lines are spoken with your Gemini key and the mouths sync to the sound." },
  { title: "Export", text: "Download an MP4 for Shorts, Reels or YouTube — up to 4K, no watermark." },
];

const FEATURES: Array<{ title: string; text: string }> = [
  { title: "Lip sync from the real voice", text: "Mouths open and change shape with the sound itself, sixty times a second, so it works in every language." },
  { title: "Captions that follow the words", text: "Pop, karaoke, boxed or clean, in any colour, in the right script for each language. Also exported as .srt." },
  { title: "Actors that act", text: "Moods, gestures, who looks at whom, a camera that follows the speaker, and a reaction on the punch line." },
  { title: "Scenes and your own pictures", text: `${BACKGROUNDS.length} drawn sets — classroom, tea shop, office, beach — or upload a photo. Change the place mid-scene.` },
  { title: "Text-only videos", text: "No characters needed: big word-by-word captions on a plain colour screen, with the same AI voices, music and sound effects — for stories, facts and quotes." },
  { title: "Music without claims", text: "Four built-in tracks made in the browser — smooth, funny, chill, suspense — or your own audio file under the voices, plus sound effects." },
  { title: "A writer when you need one", text: "Gemini drafts the dialogue in your language from a topic, and writes the YouTube title, description and tags." },
  { title: "Every shape", text: "9:16 for Shorts and Reels, 16:9 for YouTube, 1:1 for posts — at 30 or 60 frames per second." },
  { title: "Projects you can keep", text: "Your work is saved in the browser automatically; save a project file to move it or come back later." },
];

export default function Home() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-row">
          <Link href="/" className="brand">
            <Logo size={28} />
            {SITE.name}
          </Link>
          <nav className="nav-links" aria-label="Sections">
            <a href="#cast">Cast</a>
            <a href="#utubeflow">UTubeFlow</a>
            <a href="#languages">Languages</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
          </nav>
          <Link href="/editor/" className="btn btn-primary">Open editor</Link>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap hero-center">
            <p className="hero-kicker">Free AI video maker by CodeLove · Tamil, Telugu, Hindi &amp; English</p>
            <h1 className="hero-title">Turn a script into a talking cartoon video.</h1>
            <p className="hero-sub">
              Write the dialogue. {CHARACTERS.length} ready-made characters speak it with AI voices, lip sync, word-by-word captions and music — or go text-only with big captions on a plain screen. Exported as an MP4 for Shorts, Reels and YouTube.
            </p>
            <div className="hero-cta">
              <Link href="/editor/" className="btn btn-primary btn-lg">Start a video — free <ArrowRight size={17} /></Link>
              <a href="#how" className="btn btn-lg">See how it works</a>
            </div>
            <p className="hero-meta">No sign-up · No watermark · Runs in your browser with your own Gemini API key</p>
          </div>
          <div className="wrap hero-shot">
            <HeroProduct />
          </div>
        </section>

        <div className="wrap">
          <div className="platforms">
            <span>Made for</span>
            <span>YouTube Shorts</span>
            <span>Instagram Reels</span>
            <span>TikTok</span>
            <span>YouTube</span>
            <span>WhatsApp Status</span>
          </div>
        </div>

        <section id="cast" className="section">
          <div className="wrap">
            <div className="section-head">
              <h2 className="section-title">Meet the cast.</h2>
              <p className="section-sub">
                {CHARACTERS.length} characters in two drawing styles, each with a voice of their own (from {VOICES.length}). Write any name in your script and someone steps in — recast them any time. New faces are added regularly.
              </p>
            </div>
            {STYLES.map((style) => (
              <div key={style.id} className="cast-group">
                <div className="cast-group-head">
                  <h3>{style.name}</h3>
                  <p>{style.blurb} · {CHARACTERS.filter((c) => c.style === style.id).length} characters</p>
                </div>
                <div className="cast-grid">
                  {CHARACTERS.filter((c) => c.style === style.id).map((c) => (
                    <div key={c.id} className="cast-tile">
                      <Figure id={c.id} height={140} />
                      <strong>{c.name}</strong>
                      <span>{c.blurb}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="own-card">
              <span className="own-badge">Coming soon</span>
              <div>
                <h3>Create your own character</h3>
                <p>Pick the face, skin tone, hair, outfit and colours — or start from your own photo — and give them any voice. Your character, in every video you make. When {GOAL} people tap “I want this”, we build it.</p>
              </div>
              <FeatureVote feature="own-character" />
            </div>
          </div>
        </section>

        <section id="utubeflow" className="section">
          <div className="wrap">
            <div className="section-head">
              <h2 className="section-title">Made here. Scheduled on YouTube.</h2>
              <p className="section-sub">Video Maker works with <a href="https://utubeflow.codelove.in" target="_blank" rel="noopener noreferrer">UTubeFlow</a>, our free YouTube uploader and scheduler. Send a finished video straight to it — no downloading, no re-uploading.</p>
            </div>
            <ol className="steps">
              {[
                ["Make the video", "Write, cast and export your MP4 in the editor."],
                ["Send to UTubeFlow", "One button opens UTubeFlow and hands it the video with its title and description."],
                ["Sign in once", "Connect your YouTube channel in UTubeFlow with Google."],
                ["Schedule", "Pick a time — or one a day — and UTubeFlow posts it for you."],
              ].map(([title, text], i) => (
                <li key={title}>
                  <span className="step-n">0{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
            <div className="hero-cta" style={{ justifyContent: "flex-start" }}>
              <Link href="/editor/" className="btn btn-primary btn-lg">Make a video <ArrowRight size={17} /></Link>
              <a href="https://utubeflow.codelove.in" target="_blank" rel="noopener noreferrer" className="btn btn-lg">Open UTubeFlow</a>
            </div>
          </div>
        </section>

        <section id="languages" className="section">
          <div className="wrap">
            <div className="section-head">
              <h2 className="section-title">One scene, six ways to say it.</h2>
              <p className="section-sub">The voice reads the line in its own script; the caption can follow it or switch to English letters — write <code>spoken | caption</code>.</p>
            </div>
            <div className="lang-table">
              {LINES.map((l) => (
                <div key={l.name} className="lang-row">
                  <b>{l.name}<small>{l.note}</small></b>
                  <p>{l.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="section">
          <div className="wrap">
            <div className="section-head">
              <h2 className="section-title">From script to MP4 in four steps.</h2>
              <p className="section-sub">No timeline to learn and no keyframes. The editor has every setting, but the script is the only thing you have to write.</p>
            </div>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="step-n">0{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h2 className="section-title">Everything a short needs.</h2>
              <p className="section-sub">Set up already, and adjustable when you want it.</p>
            </div>
            <div className="feature-list">
              {FEATURES.map((f) => (
                <div key={f.title}>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="privacy">
              <h2>Your key and your videos stay on your device.</h2>
              <div style={{ display: "grid", gap: 12 }}>
                <p>
                  {SITE.name} has no server that sees your work. The editor runs in your browser, the video is encoded there, and your Gemini key is stored there — sent only to Google, to record the voices.
                </p>
                <p>
                  A free key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a> takes a minute and covers several videos a day.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="section">
          <div className="wrap" style={{ maxWidth: 860 }}>
            <h2 className="section-title" style={{ marginBottom: 32 }}>Questions</h2>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}<span aria-hidden="true">+</span></summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 24 }}>
          <div className="wrap">
            <div className="cta">
              <div>
                <h2>Make your first one in five minutes.</h2>
                <p>Open the editor, load the sample and press play.</p>
              </div>
              <Link href="/editor/" className="btn btn-accent btn-lg">Open the editor <ArrowRight size={17} /></Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
