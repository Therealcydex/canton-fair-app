# design-sync notes: mobile UI kit

- **Two projects, on purpose.** The mobile kit (Tailwind) and the web components (Bootstrap + Ant Design) are synced into separate Claude Design projects. Bootstrap's utilities (`.p-3`, `.px-3`, `.border`, `.shadow-sm`, `.text-center`, `.bg-white`…) share Tailwind's class names with different values and `!important`, so one shared `styles.css` would break the mobile components. This one is "Canton Fair Sourcing".
- **The kit is a wrapper package**, `ui-kits/mobile/`: `src/index.ts` re-exports the components of `mobile/src/components/ui.tsx` as they are, plus `MemoryRouter`, `Routes` and `Route` from react-router-dom (the preview provider, and what designs need around `Page` and `TabsLayout`). `Account` (needs the AuthContext) and `QrScanner` (needs the camera) are not exported.
- **Build before the converter:** `npm run build` in `ui-kits/mobile` compiles `dist/styles.css` (Tailwind with `tailwind.config.cjs`: mobile/src + previews + a safelist of palette and spacing families) and `dist/types` (tsc). npm scripts run their CLIs through `node …/cli.js` because npm on Windows runs scripts in cmd, where `../../…/.bin/x` fails.
- **`ui-kits/mobile/node_modules` is a junction** to `../../mobile/node_modules`, so that both esbuild and the converter's `@types/react` lookup find mobile's dependencies. Recreate it on a fresh clone: `cmd //c "mklink /J node_modules ..\..\mobile\node_modules"` (or `ln -s` on Unix).
- `dist/types/index.d.ts` is a one-line re-export written by `build:types`, because tsc's `rootDir` must be the repo root (the sources live in `mobile/`). Without it the converter's `.d.ts` glob misses `ui.d.ts`.
- `Button` props come from `cfg.dtsPropsFor`: the extractor drops `onClick`, `disabled` and `type`, which are inherited from `ButtonHTMLAttributes`.
- **Groups** come from the category-only stubs in `.design-sync/docs/<Name>.md`.
- **Render check uses the installed Chrome:** `DS_CHROMIUM_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"`. Only the `playwright` npm package is installed in `.ds-sync` (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`); no browser is downloaded.
- A `className` override can't beat a class the component sets itself (e.g. `min-h-[44px]` on `Button`): both are single-class utilities and Tailwind's order decides. Don't teach overrides in previews.
- Preview content is fictional (no real buyer names).

## Known render warns
- none (the final validate was clean)

## Re-sync risks
- **The Tailwind safelist is hand-picked** (`tailwind.config.cjs`). If the app starts using a new color family, add it to `colors`, or designs that use it ship unstyled. The conventions table names these families and must stay in step.
- **The re-exports in `src/index.ts` are by name.** A new component in `ui.tsx` is not synced until it is added there, given a docs stub and given a preview.
- The previews copy markup from `BoothsPage.tsx` and `ProductNew.tsx` (booth row, product form grid). If those screens change look, the previews go stale silently.
- The junction and `.ds-sync/` are per machine (both ignored by git).
