# GOGOMA — Emergency Management System (Mozambique)

React Native + Expo SDK 53, Firebase Firestore/Auth/Storage, twrnc.

## Commands

```bash
npm install          # requires legacy-peer-deps=true (set in .npmrc)
npm run dev          # expo start
npm run web          # expo start --web
npm run build        # npx expo export --platform web + SPA redirect to dist/
npx expo start -c    # clear cache and start
```

Build to `dist/`, deployed to Netlify. Script at `scripts/build-web.sh` also copies `public/` pages and `firebase-messaging-sw.js`.

## Architecture

**Entry:** `index.js` → `src/App.tsx` (wrapped in `ErrorBoundary` class component)

Two-screen toggle in a single `AppContent`:
- **Citizen** (`src/screens/CitizenScreen.tsx`) — direct Firestore registration with reCAPTCHA (web only), SOS dispatch with GPS + photos, 3-min cooldown
- **Police** (`src/screens/PoliceScreen.tsx`) — badge+password login, real-time alert dashboard, dispatch/resolve flow

Firestore real-time snapshot on `emergencias` collection (limit 1000, client-side sort by timestamp). Known errors (permission-denied, failed-precondition) silenced silently.

## Platform quirks

- Firebase auth: web uses `firebase/auth` with reCAPTCHA; native uses `@react-native-firebase/auth` (imported conditionally in `firebase.ts`)
- Web notifications intentionally disabled (no OS popups) — alarm sound via internal `AudioManager` only
- `react-native-get-random-values` polyfill imported at entry (`index.js`) — required for Firebase on native
- Image picker: web opens gallery; native opens camera directly

## Firestore collections

| Collection | Purpose | Access |
|---|---|---|
| `emergencias/{id}` | SOS alerts | create/read public, update auth'd, delete blocked |
| `usuarios/{phoneNumber}` | Citizen profiles | read/create public, update public, delete blocked |
| `comando_universal/credenciais` | Police password (SHA-256 hash) | read public, write blocked (console only) |
| `configuracoes/geral` | Municipality logo, help phone/text | read public, write open (config modal) |
| `operatorTokens/{id}` | Push notification tokens | read/write public, delete blocked |

## Police auth flow

1. Fetch credential doc from `comando_universal/credenciais`
2. Compare SHA-256 hash (new system) or legacy decrypted AES password
3. Falls back to cached password (works offline)
4. Badge ID validated against `EXPO_PUBLIC_COMMAND_ID` env var

## Style & build notes

- Dark theme (`#050507`, `#0a0a0c`), neon yellow accent (`#fbff00`)
- twrnc for Tailwind-style styling, lucide-react-native icons
- TypeScript `strict: false`, `skipLibCheck: true`
- Babel strips all `console.*` when `EAS_BUILD=true` or `NODE_ENV=production`
- Firestore: persistent local cache with `persistentMultipleTabManager()` on web
- `EXPO_PUBLIC_*` env vars in `.env.local` (gitignored, see `.env.example` equivalent in README)
