# Grabby

A personal Android app that tracks the apps you pick on [4PDA](https://4pda.to), notices when a
topic posts a new APK, downloads the right file for your phone and hands it to the installer.
Fast, factual and quiet — and it never makes you guess which version you're on.

Grabby is independent and not made by 4PDA. It reads public topic pages the way a browser
would, gently: one request per tracked topic per check, `If-Modified-Since`, an honest
User-Agent.

The visual spec is the **Grabby design system** (tokens, components, screens and states). The
app re-implements those components with the same names, props and tokens; `design/tokens.json`
is a copy of the system's tokens and the source of `src/theme/tokens.ts`.

## Getting started

Grabby needs a development build (it has its own native module), not Expo Go.

```bash
bun install
bun run android        # prebuild + build + install a debug build on a device/emulator
bun start              # Metro for the dev build
```

Release APKs come from EAS (`eas init` once to link a project, then):

```bash
bun run build:apk      # preview profile → installable APK
```

## Scripts

| script                            | does                                                                      |
| --------------------------------- | ------------------------------------------------------------------------- |
| `bun run typecheck`               | `tsc --noEmit` (strict)                                                   |
| `bun run lint`                    | ESLint with `eslint-config-expo` + Prettier compatibility, zero warnings  |
| `bun run format` / `format:check` | Prettier                                                                  |
| `bun run test`                    | Jest (`jest-expo`) unit tests — parser, versions, ABI picking, formatting |
| `bun run test:e2e`                | Maestro flows in `.maestro/` against an installed build                   |
| `bun run theme` / `theme:check`   | regenerate / verify `src/theme/tokens.ts` from `design/tokens.json`       |
| `bun run db:generate`             | Drizzle migration after changing `src/db/schema.ts`                       |

CI (`.github/workflows/ci.yml`) runs the checks and compiles the Kotlin module.

## How it fits together

```
index.ts                 registers the Unistyles theme and the background task, then expo-router
src/app/                 routes: (tabs)/ Apps · Downloads · Activity · Settings, add, app/[topicId],
                         onboarding, sign-in, install/[id] (target of the "ready" notification)
src/components/ui/       the design-system components in React Native + Unistyles
src/theme/               tokens.ts (generated), unistyles.ts (themes, dark first), icons.ts (path strings)
src/fourpda/             fetch + windows-1251 decode + parser for topic pages, with fixtures and tests
src/db/                  expo-sqlite + Drizzle schema: apps, files, downloads, activity
src/services/            checker (background + manual), download queue, notifications, session
src/native/              typed wrapper over the Kotlin module, safe when it's missing (tests)
modules/grabby-native/   Kotlin: PackageManager, WorkManager downloads, PackageInstaller, cookies, settings
drizzle/                 generated SQL migrations (bundled as strings)
```

**Checking.** `expo-background-task` (WorkManager) runs `checkAll('background')` on the interval
from Settings (1 h – daily; Android decides the exact time). Each tracked topic is fetched with
`If-Modified-Since`; changed pages are parsed, new versions logged to Activity and, for
background checks, grouped into one `updates` notification.

**Parsing 4PDA.** Pages are windows-1251. The first post holds the version (`Версия:`), the
package name, the changelog spoiler and the APKs (`/forum/dl/post/<id>/<file>`, size after the
link). Older builds in "Прошлые версии" spoilers are skipped. Many headers instead link
"Скачать" to a later post (`view=findpost&p=…`); Grabby then fetches that post for the files.
When the header has a "Модификации" spoiler (`Версия: …` lines linking to later posts), Grabby
always tracks the newest mod: it follows that post, uses its files and shows the variant
("mod Unlocked"). Variants are signed differently, so once one is tracked, updates stay on it. Otherwise the header's own
"Скачать" lines (outside spoilers) are followed, newest version first. Spoilers nest ("Прошлые
версии" → "Версии 0.x"), so every enclosing spoiler title is checked. The header's first picture
outside spoilers is the app icon, shown until the app is installed and has a launcher icon.
All three shapes are covered by fixtures modelled on real pages (Nov 2026).

**Downloads.** Rows live in SQLite; bytes move in a WorkManager job (foreground `dataSync`
service with a progress notification, resumable with `Range`, Wi‑Fi-only constraint). Two run
at once. A download that returns an HTML page instead of an APK means the 4PDA session is
missing or expired. A `.zip` build ("apk в архиве", named with a version) is unpacked by
the worker: the largest APK inside is kept and the archive deleted. RAR archives aren't supported. Finished files post a `ready` notification that deep-links to
`grabby://install/<id>`.

**Installing.** PackageInstaller sessions; Android always shows its own confirmation.
`REQUEST_INSTALL_PACKAGES` and `QUERY_ALL_PACKAGES` are declared — fine for a sideloaded personal
app, not for Play.

**Signing in.** 4PDA's own login page in a WebView. The session cookie stays in Android's cookie
jar, shared with `fetch` and the download worker; the password is never seen or stored.

## Stack

Expo SDK 58 (React Native 0.88, React 19.3, New Architecture) · TypeScript strict + React
Compiler · expo-router (typed routes) · Unistyles 3 · FlashList v2 · Reanimated 4 ·
react-native-svg · Onest + JetBrains Mono · @gorhom/bottom-sheet · expo-sqlite + Drizzle
(live queries) · react-native-mmkv · TanStack Query · zod 4 · node-html-parser + windows-1251 ·
react-native-webview · a local Kotlin Expo module · expo-notifications / background-task /
file-system / device · EAS Build + Update · Jest + Maestro · bun.

Deliberate departures from the original stack list:

- **No i18n.** UI copy is English only, inline in the components.
- **No `@react-native-cookies/cookies`.** Its last release (2022) uses `jcenter()`, which
  Gradle 9 removed, so it can't build on SDK 58. The two calls Grabby needs (read the 4PDA
  cookies, clear them on sign-out) live in the Kotlin module via `CookieManager`.
- **`lint` runs ESLint directly.** `expo lint` on SDK 58 exited 0 without reporting a planted
  warning, so it can't gate CI. Same `eslint-config-expo` rules. ESLint is pinned to 9 because
  `eslint-plugin-react` doesn't support ESLint 10 yet.

## Not verified yet

- Nothing has run on a device or emulator; the Kotlin module compiles, but downloads,
  installs, notifications and background checks are untested end to end.
- **Search** (Add app) is members-only on 4PDA, so the results parser is written
  against a guessed page shape. Save a real signed-in results page into
  `src/fourpda/__fixtures__/search.html` and adjust `parseSearch` if needed.
- Guest downloads from `/forum/dl/post/…` return 404 HTML, so in practice downloads need a
  signed-in session.
