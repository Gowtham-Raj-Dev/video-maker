/** The site's name and address live here only: change them in this one file (and next.config.mjs, public/CNAME). */
export const SITE = {
  name: "Video Maker",
  /** The name with the brand, for titles and structured data. */
  fullName: "CodeLove Video Maker",
  tagline: "Turn a script into a talking cartoon video.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://videomaker.codelove.in",
  // ~60 characters so Google shows it whole; the strongest words first.
  title: "Free AI Video Maker: Talking Cartoon & Text to Video",
  // ~155 characters: what it is, what you get, why it's free.
  description:
    "Free AI video maker and talking cartoon maker by CodeLove. Turn text to video with AI voices, lip sync and captions for YouTube Shorts. No sign-up.",
  /** The longer pitch, for social cards and structured data. */
  longDescription:
    "CodeLove Video Maker is a free AI video maker that runs in your browser. Type a dialogue and 66 cartoon characters act it out with real AI voices, lip sync, word-by-word subtitles and background music — or make a text-only video with big captions on a plain screen. Tamil, Tanglish, Telugu, Hindi, Hinglish and English. Export MP4 for YouTube Shorts, Instagram Reels and YouTube up to 4K. No sign-up, no watermark, your own free Gemini API key.",
  creator: "Gowtham",
  creatorUrl: "https://gowtham.codelove.in",
  brand: "CodeLove",
  brandUrl: "https://codelove.in",
  email: "gowtham@codelove.in",
} as const;

/** The same labels on every CodeLove site. */
export const NETWORK_LINKS: ReadonlyArray<{ label: string; href: string; title: string }> = [
  { label: "CodeLove", href: "https://codelove.in", title: "CodeLove — Main Hub" },
  { label: "Free 3D Models", href: "https://models.codelove.in", title: "Free 3D model library" },
  { label: "Free 3D Games", href: "https://games.codelove.in", title: "Free 3D games in browser" },
  { label: "Insta Downloader", href: "https://downloader.codelove.in", title: "Free Instagram Reels, video & photo downloader" },
  { label: "Link in Bio", href: "https://linkinbio.codelove.in", title: "Free link-in-bio pages" },
  { label: "Video to GIF", href: "https://videotogif.codelove.in", title: "Convert video to GIF" },
  { label: "Video to Images", href: "https://videotoimages.codelove.in", title: "Extract frames, compress & convert videos" },
  { label: "Video Cut", href: "https://videocut.codelove.in", title: "Split long videos into Shorts" },  { label: "Free YouTube Automation", href: "https://utubeflow.codelove.in", title: "Bulk upload & schedule YouTube videos" },
  { label: "Free Java Games", href: "https://javaplay.codelove.in", title: "Play old Java J2ME phone games" },
];

export const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "How do I make a text to video AI free?",
    a: "Open the editor, choose “Text only” and type your text. Video Maker turns it into a video with big word-by-word captions, an AI voice and music, with no sign-up and no watermark. It is a free text to video AI that uses your own free Gemini key.",
  },
  {
    q: "What is a talking cartoon maker?",
    a: "A talking cartoon maker turns written dialogue into cartoon characters that speak it. In Video Maker you write the lines, pick a character and voice for each name, and the mouths move in sync with the sound. It works as a free cartoon video maker for Shorts, Reels and YouTube.",
  },
  {
    q: "Can I make a Tamil cartoon video?",
    a: "Yes. Video Maker is a Tamil cartoon video maker: write Tamil or Tanglish dialogue, pick a Tamil voice and your characters speak it with Tamil captions. Telugu, Hindi, Hinglish and English work the same way.",
  },
  {
    q: "Is this a YouTube Shorts maker?",
    a: "Yes. Export in 9:16 and the video is ready for YouTube Shorts, Instagram Reels or TikTok. You can then send it to UTubeFlow to schedule it on YouTube for free.",
  },
  {
    q: "Is this a free AI video maker?",
    a: "Yes. CodeLove Video Maker turns a typed script into a finished video with AI voices, lip-synced cartoon characters, subtitles and music — free, with no sign-up and no watermark. The AI voices and the optional AI script writer use Google Gemini through your own free API key.",
  },
  {
    q: "Can I make a video without cartoon characters?",
    a: "Yes. Choose “Text only” at the top of the Script panel: the video becomes big word-by-word subtitles on a plain colour screen (or a picture), with the same AI voices, smooth background music and sound effects. It suits stories, facts, quotes and narration videos.",
  },
  {
    q: "Is Video Maker free?",
    a: "Yes. The site is free and adds no watermark. The voices come from Google's Gemini API using your own API key, and Google gives every key a free daily limit — enough for several videos a day.",
  },
  {
    q: "Where do I get a Gemini API key?",
    a: "Open Google AI Studio (aistudio.google.com/apikey), sign in with a Google account and press “Create API key”. Copy it and paste it into the API key box here. It takes about a minute and needs no card.",
  },
  {
    q: "Is my API key safe?",
    a: "Your key is saved only in your own browser and is sent only to Google's API, straight from your device. Video Maker has no server that sees your key, your script or your video.",
  },
  {
    q: "Which languages work?",
    a: "Tamil, Tanglish, Telugu, Hindi, Hinglish and English are built in, each with matching subtitle fonts. The lip sync is worked out from the sound of the voice itself, so it fits any language the voice can speak.",
  },
  {
    q: "How does the lip sync work?",
    a: "After the voice is recorded, Video Maker measures how loud and how bright the sound is sixty times a second and opens and shapes the character's mouth to match — so mouths move exactly with the words.",
  },
  {
    q: "Can I use the videos on YouTube Shorts, Reels and TikTok?",
    a: "Yes. Videos export as MP4 in 9:16 for Shorts, Reels and TikTok, 16:9 for YouTube, or 1:1 — up to 4K. The characters, backgrounds and music are all made by Video Maker, so there is nothing to license.",
  },
  {
    q: "Why does voice recording sometimes wait or stop?",
    a: "Free Gemini keys allow only a few voice requests a minute and a fixed number a day. Video Maker waits and retries by itself; if the daily limit is used up, try later or add a second key (keys separated by a comma are used in turn). Voices already recorded are reused, so changing the look never spends the limit again.",
  },
];
