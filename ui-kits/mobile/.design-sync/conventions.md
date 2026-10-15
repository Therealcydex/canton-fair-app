# Sourcing — mobile UI kit (conventions)

This is the phone app buyers use at the Canton Fair. Screens are narrow (about 390 px wide) and the UI text is **French**. The components are `Page`, `TabsLayout`, `Card`, `Button`, `Field`, `Badge`, `ErrorBox`, `Notice` and `Loading`, plus the `inputClass` string, all on `window.SourcingMobileUI`.

## Setup

- **Wrap every design in `MemoryRouter`**, which the kit exports. `Page` (back arrow) and `TabsLayout` (tab links) use react-router and crash outside a router. Never nest a second router.
- For a screen with the bottom tab bar, use `TabsLayout` as a layout route. It renders its child route above a fixed bar with the tabs "À visiter / Stands / Fournisseurs / Compte":

```jsx
const { MemoryRouter, Routes, Route, TabsLayout, Page, Card, Badge, inputClass } = window.SourcingMobileUI;
<MemoryRouter>
  <Routes>
    <Route element={<TabsLayout />}>
      <Route path="*" element={
        <Page title="Stands">
          <input className={inputClass} placeholder="Fournisseur ou code du stand" />
          <Card className="flex items-center gap-3">
            <div className="w-28 shrink-0 font-bold">11.3J26</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">Ningbo Bright Lighting Co.</div>
              <div className="truncate text-sm text-slate-500">Éclairage LED</div>
            </div>
            <Badge className="bg-green-100 text-green-800">Visité</Badge>
          </Card>
        </Page>
      } />
    </Route>
  </Routes>
</MemoryRouter>
```

## Styling idiom: Tailwind utility classes (no tokens, no theme props)

Style your layout with Tailwind v3 classes on plain elements and through `className` on `Card`, `Badge` and `Button`. The page background is `bg-slate-100` (set on `body`) and the font is the system sans-serif.

| Role | Classes |
|---|---|
| Text | `text-slate-900` body, `text-slate-700` labels, `text-slate-600`/`text-slate-500` secondary, `text-xs`/`text-sm`/`text-lg`, `font-medium`/`font-semibold`/`font-bold` |
| Primary/accent | `bg-blue-600` (buttons), `text-blue-600` (active tab), `text-blue-700` (prices, links) |
| Surfaces | `bg-white rounded-xl shadow-sm p-3` (what `Card` renders), `bg-slate-900` header, `border-slate-200` dividers |
| Status badges | visited `bg-green-100 text-green-800`, to visit `bg-orange-100 text-orange-800`, warning `bg-amber-50 border-amber-300 text-amber-900`, error `bg-red-100 text-red-800` |
| Spacing | `space-y-2`/`space-y-3` for stacks, `gap-2`/`gap-3`, `grid grid-cols-2 gap-3` for paired fields |
| Section heading | `px-1 text-sm font-semibold uppercase tracking-wide text-slate-500` |
| Empty state | `py-8 text-center text-slate-500` |

The shipped CSS is a compiled Tailwind build. It covers these families (slate, blue, red, green, orange and amber at shades 50–900; spacing 0–24; `rounded-*`, `shadow-*`) and every class the app uses. A class outside them, such as purple colors or arbitrary values, will **not** be styled.

## Components

- `Page title back? action?`: a sticky dark header and a padded stack (`space-y-3 p-3`). Put the screen's content directly inside it.
- `Button variant="primary|secondary|danger"`: at least 44 px tall. Add `className="w-full"` for form buttons.
- `Field label hint?` wraps one native `<input>`, `<select>` or `<textarea>`, which takes `className={inputClass}`.
- `Badge` has no colors of its own: always pass a pair of status classes from the table above.
- `ErrorBox message` and `Notice message` render nothing when the message is empty. Use them for server refusals and confirmations.
- `Loading` is a centered "Chargement…".

Read `styles.css` (→ `_ds_bundle.css`) for the exact class list, and `components/<group>/<Name>/<Name>.prompt.md` for each component's examples.
