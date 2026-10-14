# Sourcing — mobile app

App for buyers on the fair floor: sign-up, booths to visit (one tap marks a booth visited), quick product entry with
photos, supplier lookup. Online only (BNF04). Vite 4, React 18, TypeScript, Tailwind 3,
Capacitor 8 (Android).

## Run in the browser

```bash
npm install
cp .env.example .env          # set VITE_API_BASE_URL
npm run dev                   # http://localhost:5173
```

The backend must be running (`backend/`, `npm run dev`).

## Build the Android app

The Capacitor CLI needs **Node 22 or later** (the backend and web app run on Node 20).

```bash
# once: create the Android project (mobile/android/, not committed)
npx cap add android

# each time
npm run android:sync          # build + copy into the Android project
npm run android:open          # open in Android Studio
```

On a phone, `VITE_API_BASE_URL` must be the address of the server on the network (for example
`http://192.168.1.20:3000/api`), not `localhost`. Development uses plain http
(`capacitor.config.ts`: `androidScheme: 'http'`, `cleartext: true`); switch to https before
publishing.

## Rules

- Every request goes through `authFetch` then `ensureOk` (`src/config/api.ts`): `fetch` does not
  fail on 400/403/409, and a refused save must keep the form open with the server's message.
- No business rule is re-implemented here: the app sends the data and shows the server's answer.
