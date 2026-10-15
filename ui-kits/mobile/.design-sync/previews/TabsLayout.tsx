import { Badge, Card, Page, Route, Routes, TabsLayout } from 'sourcing-mobile-ui';

export const ToVisit = () => (
  <div className="h-full w-full bg-slate-100">
    <Routes>
      <Route element={<TabsLayout />}>
        <Route path="*" element={
          <Page title="À visiter">
            <section className="space-y-2">
              <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Phase 1 · Hall 11</h2>
              <Card className="flex items-center gap-3">
                <div className="w-28 shrink-0 font-bold">11.3J26</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">Ningbo Bright Lighting Co.</div>
                  <div className="truncate text-sm text-slate-500">Éclairage LED</div>
                </div>
              </Card>
              <Card className="flex items-center gap-3">
                <div className="w-28 shrink-0 font-bold">11.2C05</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">Foshan Sunway Electric</div>
                  <div className="truncate text-sm text-slate-500">Matériel électrique</div>
                </div>
                <Badge className="bg-orange-100 text-orange-800">À visiter</Badge>
              </Card>
            </section>
          </Page>
        } />
      </Route>
    </Routes>
  </div>
);
