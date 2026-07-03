# CLAUDE.md — B1+Trainer build conventions

Guidance for implementing the B1+Trainer designs (`README.md` + `STATE_AND_INTERACTIONS.md`) as a **React Native** app for iOS (App Store) and Android (Play Store).

> The `.dc.html` / `.jsx` / `support.js` files in this bundle are **design references**, not app code. Recreate the screens natively; do not embed the HTML or port its inline styles verbatim. Map every HTML value to the theme tokens below.

## Recommended stack
- **Expo (managed)** unless there's a reason to go bare — it covers fonts, audio, notifications, secure store, and both stores cleanly. (Bare RN is fine; keep the same libraries.)
- **Navigation**: React Navigation — native-stack for the auth/onboarding pre-app flow and for pushed screens; a **custom bottom tab bar** for the tabs (see the "island" spec — do not use the default tab bar chrome). **v1 renders 4 tabs** — the **Klasse** tab is hidden behind the `class_enabled` remote feature flag (off) and appears (5-tab bar) only when the flag is flipped on as the concurrent teacher app ships. **Lernen** is not a tab and gets no nav icon — it is reached only from the Home screen and pushes onto the Heute stack.
- **Icons**: `react-native-svg` + a set like `lucide-react-native`, or hand-port the exact SVG paths from the reference (24×24 viewBox, stroke 1.6–1.9). Brand marks (Google/Apple) as their official SVGs.
- **Fonts**: `expo-font` / `@expo-google-fonts` — **Source Serif 4** (display/headings/**all numerals**), **IBM Plex Mono** (typed exam text), **Jost** (UI face). **Ship Jost** (SIL OFL, what the mocks were built with); **Futura is not licensed/embedded** (decision 2026-07-02).
- **Audio**: `expo-av` (or `react-native-audio-recorder-player`) for Sprechen recording/playback; on-device speech feedback for Aussprache/Nachsprechen ("wird nicht bewertet"). Recording max **300s** with a countdown; upload for teacher grading; client-side, treat the recording as **ephemeral (server deletes 24h after grading)**.
- **Storage**: `expo-secure-store` for tokens; `AsyncStorage`/MMKV for drafts (exam per-aufgabe text), settings, onboarding flag.
- **State/data**: React Query (or similar) for server data (Redemittel, exercises, class, grading); lightweight context/store for session, theme, onboarding.
- **Notifications**: `expo-notifications` for the daily reminder + class-assignment alerts (opt-in on screen 07).
- **In-app browser**: open the "Kurse auf unserer Website" link in the **external browser** (`Linking.openURL`), per spec — not an in-app webview.

## Theme (map the tokens → one theme object)
Provide `light` and `dark` theme objects and a `ThemeProvider` that follows the OS (`useColorScheme`) with a manual override (Settings: System/Hell/Dunkel). Never hardcode hex in components — read from theme. Example shape:

```ts
export const theme = {
  light: {
    bg:'#FDFBF6', surface:'#FFFFFF', surfaceSunken:'#FCFAF5', surfaceAlt:'#F4F0E7',
    textHi:'#211C17', textBody:'#4F463C', textMuted:'#75695C', textFaint:'#BCAE9C',
    border:'rgba(33,28,23,0.09)', track:'#EFEAE1',
    primaryBtnBg:'#1C1815', primaryBtnFg:'#FFFFFF',
    cardShadow:{ /* 0 1 2 .045 + 0 5 16 .035 */ },
  },
  dark: {
    bg:'#15120E', surface:'#221D18', surfaceSunken:'#2E2925', surfaceAlt:'#2A241D',
    textHi:'#F3EEE6', textBody:'#C4BBAD', textMuted:'#928777', textFaint:'#6B6052',
    border:'rgba(255,255,255,0.08)', track:'#332C23',
    primaryBtnBg:'#F3EEE6', primaryBtnFg:'#1C1815',
  },
  // shared (both themes):
  accent: {
    gruen:'#1C8A5B', gruenAlt:'#2E9E6B', gruenDarkText:'#34B97E',
    blau:'#2B7FD4', blauDarkText:'#5B9BE0',
    lila:'#7A52D9', lilaDark:'#9D78E6',
    gold:'#DD8A22', goldText:'#B96F12', goldHi:'#FFC95C',
    rot:'#D6463C', rotText:'#C0392E', rotDark:'#E8776C',
  },
  cefr: { B1:'#2E9E6B', B2:'#2B7FD4', C1:'#7A52D9', C2:'#BE8226' },
  radius: { input:15, card:18, cardLg:24, tile:12, chip:11, badge:6, pill:999 },
  font: { serif:'SourceSerif4', ui:'Jost', mono:'IBMPlexMono' },
};
```
Accents, CEFR colors, and radii are **shared** across themes. The primary button **inverts** (ink on light, paper on dark); accent buttons (green "Weiter"/"Zum Start") keep their accent in both themes.

## Component conventions
- Build a small primitives layer that mirrors README "Reusable components": `Screen`, `Card`, `EyebrowLabel`, `PrimaryButton`/`SecondaryButton`/`AccentButton`, `LevelBadge`, `ProgressBar`, `RingGauge` (SVG), `Segmented`, `ListRow`, `WordTile`, `Waveform`, `Caret`, `IslandTabBar`, `StepDots`, `Toggle`, `Calendar`.
- **Numerals & titles → Source Serif 4** (scores, timers, streak, prices, big headings). **Typed exam text → IBM Plex Mono.** Everything else → **Jost**. Keep weights per the type scale.
- Respect **safe-area insets** (`react-native-safe-area-context`); the HTML's ~54px top padding stands in for the status-bar/notch area.
- The **island tab bar** is a custom floating component (blur via `expo-blur`), not the default navigator tab bar. Active tab = green rounded square + white glyph. **v1 shows 4 items (no Klasse);** the 5th appears when `class_enabled` flips on.
- Use `gap` (RN 0.71+) / flex for spacing, not margin hacks. Match the radii/shadows exactly.

## Translation of the HTML (how to read the reference)
- Each screen lives in `B1 Trainer Mobile.dc.html` as an inline-styled block inside an `IOSDevice` frame; the light row is first, the dark row second (same order). Read a block's inline styles for exact px/hex/copy, then rebuild with theme tokens + primitives.
- The floating island, status bar, and home indicator are **presentation chrome** — replace with the real tab bar + safe areas.
- German copy in the reference is final UI copy; keep it (and route it through i18n). The Redemittel **translations** shown are examples in the user's chosen language.

## i18n & content
- UI language is **German** (keep exact strings; wrap in an i18n layer for maintainability).
- **Redemittel translations** render in the user's **Muttersprache** (Settings). Exercise/reference content comes from the server Redemittel dataset — **Sprechen exercise phrases in the mock are placeholders; wire them to real Redemittel**.

## Business rules to enforce (see STATE_AND_INTERACTIONS §3)
- Exam: per-aufgabe **countdown** (Goethe times summing to 60 min total); **switch aufgaben without losing text** (persist drafts); **word limits 200 / 100**; async KI grading (4-Augen); **unlimited attempts**; Fortschritt lists **latest of each of 4** sims; class attempts can be **sent to the teacher**.
- Class **(built but hidden behind the `class_enabled` flag, off in v1 — these are the flag-on rules)**: join by code+email or via external site; **Sprechen recording ≤ 5:00** countdown; review → **Absenden**/**Neu aufnehmen**; **Sprechen Bewertung gated on teacher grading**; **recording deleted 24h after grading**; Sprechen Probeprüfungen only when enrolled; **only Teil 2** exists now.
- Levels: **B1 only**; B2/C1 locked ("Bald verfügbar"). *(This niveau lock is a separate feature — unrelated to the `class_enabled` flag.)*
- Theme follows system with manual override; exam date optional; reminders opt-in.

## Backend integration (v1) — see the backend spec set (`mobile-app/backend/09`–`13` in the goethe-b1-docs workspace)
- **Auth = Supabase Auth.** Primary sign-in = **magic-link + Google/Apple idToken**; **email OTP is the fallback** (8-digit, ≤120 s). Use `supabase-js` with a chunked `expo-secure-store` adapter, PKCE, `AppState` autorefresh; nonce-bound Google/Apple idToken; hardened deep-link handler. Role lives in `app_metadata` (never `user_metadata`).
- **`class_enabled` feature flag (remote, off in v1)** gates everything class/teacher-dependent so it can go live without an app-store release. Hidden until flipped: the **Klasse tab** (screens 29–34), **Sprechen Bewertung** (28), the **class-code auth path** (01 "Mit Klassencode" link + screen 02), the **Heute "Deine Klasse" card**, **Probeprüfungen·Sprechen**, and the exam result's **"An Lehrkraft senden"** action. Build the screens; render only when the flag is on.
- **Trusted server = Next.js `/api` on Vercel** (project A). Client calls it with a Bearer JWT (`authedFetch` w/ silent refresh-on-401). Client-direct Supabase reads/writes go via `supabase-js` (anon key + JWT) so RLS applies; high-trust writes (persist exam grade, `record_attempt`) go through the server/RPC.
- **Writing-exam grading** streams NDJSON from `POST /api/exam/grade`; render the Vier-Augen progress live off the stream (no refetch); the grade is **persisted server-side** — a persist failure still shows the grade with a retry. Rate-limited (per-user **6/h + 15/day**, plus a global backstop) — handle **429** by reading `Retry-After`, showing a German cooldown, and disabling the input.
- **Retention:** the student's own essay + grade are retained (feeds Fortschritt history). On-device Sprechen *practice* (20–22) stores nothing.
- **Loading/empty/error states are not designed** — implement them to STATE §6 (skeletons; async "Bewertung wird erstellt…"; permission-denied for mic/notifications; invalid-code errors; retry on submit/upload).

## Accessibility & platform
- Hit targets **≥44px** (buttons are 52–56px; tab items 52×42). Provide labels for icon-only controls (tab items, hint bulb, back/close, play/record).
- Support Dynamic Type where feasible (the type scale is generous); ensure contrast holds in both themes.
- Test on both iOS and Android; verify Jost renders identically across platforms. Handle Android back button for stacks/sheets.

## Don'ts
- Don't ship the HTML/`support.js`/`ios-frame.jsx`.
- Don't hardcode colors/px in components — use the theme.
- Don't use the default tab bar chrome, an in-app webview for the class-search link, or web-only CSS (backdrop-filter → `expo-blur`, `@keyframes` → `Animated`/Reanimated).
- Don't persist Sprechen recordings beyond the grading window.
