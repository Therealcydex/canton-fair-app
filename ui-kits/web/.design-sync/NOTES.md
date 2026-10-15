# design-sync notes: web UI kit

- **This is a separate project from the mobile kit** ("Canton Fair Sourcing Web"). Bootstrap's utility classes collide with Tailwind's (same names, different values, `!important`), so the two kits can't share a `styles.css`. See `ui-kits/mobile/.design-sync/NOTES.md`.
- **The kit is a wrapper package**, `ui-kits/web/`:
  - `src/index.js` re-exports `AppLayout` and `FormModal` from `frontend/src/components` as they are.
  - It exports the Ant Design components the screens use as one lowercase `antd` object. Lowercase, so the converter doesn't treat each one as a component card. Keep the list in step with the imports under `frontend/src/feature-module`.
  - It exports `Routes`, `Route` and `Link`.
  - `Guards` (`RequireAuth`, `RequireAccess`) are left out: they only control access and draw nothing.
- **`src/WebRoot.jsx` is kit-authored**: the provider chain of `frontend/src/App.js` plus a `MemoryRouter`. `AuthContext` is not exported by the app, so `WebRoot` seeds `localStorage.authUser` before `AuthProvider` mounts. The default user is a fictional admin. If `App.js` gains a provider, add it here.
- **`src/process-shim.js` is imported first.** `frontend/src/config/config.js` reads `process.env.REACT_APP_API_BASE_URL`, and the converter only defines `process.env.NODE_ENV`, so without the shim the bundle throws "process is not defined" when it loads.
- The JSX is compiled with esbuild's classic runtime (the frontend has no tsconfig). It works because `React` is the global from `_vendor/react.js`.
- **CSS:** `npm run build` (`scripts/build-css.cjs`) joins `bootstrap.min.css` and `frontend/src/index.css` into `dist/styles.css`, in the order of `frontend/src/index.js`. Ant Design 5 injects its CSS at runtime.
- **`ui-kits/web/node_modules` is a junction** to `../../frontend/node_modules`. Recreate it on a fresh clone with `cmd //c "mklink /J node_modules ..\..\frontend\node_modules"`.
- **The FormModal preview mounts the modal inside the card.** It uses `ConfigProvider getPopupContainer` and a `transform` on the container. Otherwise Ant Design portals it to `document.body` and the card captures blank.
- `AppLayout` and `FormModal` have no TypeScript types: their props come from `cfg.dtsPropsFor`. Update that entry if `FormModal`'s props change.
- The render check uses the installed Chrome (`DS_CHROMIUM_PATH`), same as the mobile kit.

## Known render warns
- `[FONT_MISSING] "source-code-pro"`: CRA's default `code { font-family: source-code-pro, Menlo, … }` in `index.css`. The real app doesn't ship that font either and falls back to Menlo/Consolas the same way. Accepted as is, and reported to the user.

## Re-sync risks
- The `antd` export list and `WebRoot` duplicate choices made in `frontend/src` (the screens' imports, `App.js`'s providers). They go stale silently when those change.
- `dtsPropsFor.FormModal` is hand-written.
- The bundle is about 3 MB unminified, almost all Ant Design.
