# Sourcing — mobile app

App for buyers on the fair floor (accounts are created by the admin, D46): booths to visit (one tap marks a booth visited), quick product entry with
photos, supplier lookup. Online only (BNF04). Vite 4, React 18, TypeScript, Tailwind 3,
Capacitor 8 (Android).

## Run in the browser

```bash
npm install
cp .env.example .env          # set VITE_API_BASE_URL
npm run dev                   # http://localhost:5173
```

The backend must be running (`backend/`, `npm run dev`).

## Test on a phone (Wi-Fi)

The QR code scanner opens the camera, which browsers only allow on **https**. So, for a phone:

```bash
npm run dev:phone             # https://<PC address on the Wi-Fi>:5173
```

- On the phone (same Wi-Fi), open `https://<PC address>:5173`, for example
  `https://192.168.0.130:5173` (`ipconfig`, "Wireless LAN adapter Wi-Fi", IPv4 Address; it changes
  with the Wi-Fi network).
- The certificate is a local one: accept the warning once ("Advanced", then "Proceed").
- The dev server passes `/api` and `/uploads` to the backend on the PC (port 3000, or
  `VITE_DEV_API_TARGET`), so `.env` needs no PC address in this mode.
- Windows firewall: allow Node.js on private networks.

Without https (plain `npm run dev` opened from a phone), the scanner offers "Prendre une photo
du QR à la place" and reads the QR code from the photo.

## Build the Android app

The Capacitor CLI needs **Node 22 or later** (the backend and web app run on Node 20).

```bash
# once: create the Android project (mobile/android/, not committed)
npx cap add android

# each time
npm run android:sync          # build + copy into the Android project
npm run android:open          # open in Android Studio
```

The QR code scanner needs the camera: after `npx cap add android`, check that
`android/app/src/main/AndroidManifest.xml` has
`<uses-permission android:name="android.permission.CAMERA" />` (add it otherwise).

On a phone, `VITE_API_BASE_URL` must be the address of the server on the network (for example
`http://192.168.1.20:3000/api`), not `localhost`. Development uses plain http
(`capacitor.config.ts`: `androidScheme: 'http'`, `cleartext: true`); switch to https before
publishing.

## Business cards

"Scanner une carte de visite" (new supplier, new contact) reads the card on the phone with
tesseract.js, in English (D37). Its files (about 11 MB on the server, 7 MB downloaded once by the
phone) are copied from node_modules to `public/ocr/` by `scripts/copy-ocr.cjs` before `npm run
dev`, `dev:phone` and `build`; they are not committed. The fields found are only suggestions:
the buyer checks them before saving.

## Rules

- Every request goes through `authFetch` then `ensureOk` (`src/config/api.ts`): `fetch` does not
  fail on 400/403/409, and a refused save must keep the form open with the server's message.
- No business rule is re-implemented here: the app sends the data and shows the server's answer.
