# CLAUDE.md — B1+Trainer build conventions

> Part of the goethe-b1 monorepo — see the root [CLAUDE.md](../../CLAUDE.md) for workspace layout, shared packages, and monorepo-wide commands. This file covers `apps/mobile` specifically.

Guidance for implementing the B1+Trainer designs (`README.md` + `STATE_AND_INTERACTIONS.md`) as a **React Native** app for iOS (App Store) and Android (Play Store).

> The `.dc.html` / `.jsx` / `support.js` files in the `design/` folder are **design references**, not app code. Recreate the screens natively; do not embed the HTML or port its inline styles verbatim. Map every HTML value to the theme tokens below.

## Commands

```bash
npm run start        # expo start
npm run ios          # expo run:ios
npm run android       # expo run:android
npm run web           # expo start --web
npm run typecheck     # tsc --noEmit (strict mode) — this is the correctness gate; no lint script, no test runner
```

`AGENTS.md` in this folder flags that this is Expo SDK 56, versioned docs differ from training data — read `https://docs.expo.dev/versions/v56.0.0/` before writing framework code. Native `ios/`/`android/` prebuild projects exist (Xcode project `B1Trainer`) — see [Entitlements: restore before store] in project memory for why Apple Sign-In / Push entitlements are currently commented out in `ios/B1Trainer/B1Trainer.entitlements` (free/personal Apple dev team can't sign them; restore + a paid account before TestFlight/App Store).

## Source layout (`src/`)

`components/` (shared widgets), `features/` (screens by domain), `navigation/`, `lib/`, `theme/`.

State/data: React Query (`@tanstack/react-query`) for server data; a custom `SessionProvider` context (`lib/session.tsx`) for auth/session state — no Redux/Zustand.

## Backend integration

Two separate backend API bases, both Supabase-JWT authenticated:
- **`EXPO_PUBLIC_API_BASE`** → `apps/web`'s Next.js `/api` routes (Vercel Project A) — exam grading/email, profile, account management. Called via `authedFetch()` in `lib/api.ts` (attaches a Bearer JWT, retries once on 401 after a silent session refresh). Writing-exam grading streams NDJSON from `POST /api/exam/grade` using `expo/fetch` (RN's built-in `fetch` can't read streams).
- **`EXPO_PUBLIC_LMS_API_BASE`** → `apps/teacher-web`'s `/api` routes (Vercel Project B) — used for `/api/speaking/*` (class/teacher features). Called via `authedLmsFetch()`. Same Supabase project as web, so the student JWT is valid there too.
- Speaking submission is a 3-step flow: `speakingSubmit` (get presigned URL) → `uploadSpeakingAudio` (direct PUT to Cloudflare R2, no bearer, must be `Content-Type: audio/m4a`) → `speakingFinalize` (trigger transcription/scoring).

**Auth = Supabase Auth**, sole identity provider. `lib/supabase.ts` builds the client with PKCE flow, `persistSession`/`autoRefreshToken` on, and a **custom chunked `expo-secure-store` adapter** (SecureStore has a 2048-byte limit, so sessions are base64-encoded and split into `${key}.0..n` chunks; corrupt/partial reads are treated as signed-out). An `AppState` listener starts/stops Supabase's `autoRefresh` on foreground/background. `lib/auth.ts`: primary sign-in is email magic-link/OTP fallback (8-digit code via the hardened `/api/auth/otp` proxy in `apps/web`, Turnstile-gated) + Apple idToken sign-in (nonce-bound). **Google sign-in is stubbed/throws** — no OAuth client configured yet, the native module is intentionally not linked to avoid pulling in AppCheckCore/GoogleUtilities pods. Role/authorization lives in Supabase `app_metadata` (never `user_metadata`).

**TTS / audio session** ([lib/tts.ts](src/lib/tts.ts)): iOS's default `soloAmbient` audio session respects the silent switch, so `expo-speech` TTS would be silent unless reconfigured. `ensureSpeechAudioMode()` calls `expo-audio`'s `setAudioModeAsync` once and caches the in-flight promise so concurrent callers await the same session switch instead of racing into the default silent session; `resetSpeechAudioMode()` clears that cache and must be called after speech-recognition runs (`expo-speech-recognition` leaves the session in a quieter `.playAndRecord`/`"measurement"` mode and doesn't restore it). Use `speakDe()`, never call `Speech.speak` directly.

**Metro** ([metro.config.js](metro.config.js)) watches the whole monorepo root so it can transpile the raw-TS workspace packages (`@repo/core`, `@repo/types`) directly — no build step, mirroring how `apps/web` handles the same packages via Next's `transpilePackages`.

## Environment (`.env.local`, see `.env.example`)

Two non-obvious entries: the `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`/`_GOOGLE_IOS_CLIENT_ID` pair is unused while Google sign-in is stubbed, and `EXPO_PUBLIC_CLASS_ENABLED` is a dev-only override for the remote `class_enabled` feature flag.

## Product rules the library choices must serve
*(Libraries in use are in `package.json`; what follows is the non-obvious part.)*
- **Navigation**: React Navigation — native-stack for the auth/onboarding pre-app flow and for pushed screens; a **custom bottom tab bar** for the tabs (see the "island" spec — do not use the default tab bar chrome). **v1 renders 4 tabs** — the **Klasse** tab is hidden behind the `class_enabled` remote feature flag (off) and appears (5-tab bar) only when the flag is flipped on as the concurrent teacher app ships. **Lernen** is not a tab and gets no nav icon — it is reached only from the Home screen and pushes onto the Heute stack.
- **Icons**: hand-ported SVG paths from the reference (24×24 viewBox, stroke 1.6–1.9). Brand marks (Google/Apple) as their official SVGs.
- **Fonts**: `expo-font` / `@expo-google-fonts` — **Source Serif 4** (display/headings/**all numerals**), **IBM Plex Mono** (typed exam text), **Jost** (UI face). **Ship Jost** (SIL OFL, what the mocks were built with); **Futura is not licensed/embedded** (decision 2026-07-02).
- **Audio**: on-device speech feedback for Aussprache/Nachsprechen is labelled "wird nicht bewertet". Recording max **300s** with a countdown; upload for teacher grading; client-side, treat the recording as **ephemeral (server deletes 24h after grading)**.
- **Notifications**: opt-in on screen 07 — daily reminder + class-assignment alerts.
- **In-app browser**: open the "Kurse auf unserer Website" link in the **external browser** (`Linking.openURL`), per spec — not an in-app webview.

## Theme (map the tokens → one theme object)
Provide `light` and `dark` theme objects and a `ThemeProvider` that follows the OS (`useColorScheme`) with a manual override (Settings: System/Hell/Dunkel). Never hardcode hex in components — read from theme. The token values (palettes, `accent`, `cefr`, `radius`, `font`) live in [src/theme/tokens.ts](src/theme/tokens.ts).

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
