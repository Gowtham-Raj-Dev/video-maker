# Video Maker — videomaker.codelove.in

Script type pannaa, lip sync + voice + subtitle oda cartoon video (MP4) kedaikkum. Ellaam browser-la thaan odum;
voice-ku user-oda **sondha Gemini API key**. Namma server edhuvum illa (static site, GitHub Pages).

```
pnpm dev      # http://localhost:3010
pnpm build    # static export → out/
```

## Eppadi velai seiyyudhu

1. `src/engine/script.ts` — script-ah padikkum: `Name (mood): pesura vaarthai | subtitle`, `[bg: park]`.
2. `src/engine/voice.ts` + `gemini.ts` — Gemini TTS (user key, browser-la irundhu straight-aa Google-ku).
   Rendu per pesura lines-ah ore request-la record panni, pause-la vetti line line-aa pirikkum (limit micham).
   Record aana voice IndexedDB-la irukkum — look maathinaa thirumba record aagaadhu.
3. `src/engine/audio.ts` — lip sync (voice-oda loudness → vaai thirakkum, brightness → vaai agalam), music, sound effects, mix.
4. `src/engine/renderer.ts` — oru frame varaiyum: background, characters, acting, subtitles, title.
5. `src/engine/export.ts` — WebCodecs + mp4-muxer la MP4 (4K varai); WebCodecs illaatti MediaRecorder.

Characters: `src/engine/characters.ts` (13 per, namma sondha design). Backgrounds: `src/engine/backgrounds.ts` (16).
Site peyar / domain: `src/lib/site.ts`, `next.config.mjs`, `public/CNAME`, `.github/workflows/deploy.yml`.

## Innum panna vendiyadhu

- GitHub repo create panni push → Settings → Pages → Source: GitHub Actions. DNS: `videomaker` CNAME → `<user>.github.io`.
- GA4 / AdSense IDs innum podala.
- Matha CodeLove sites-oda network footer-la "Video Maker" link serkkala.
