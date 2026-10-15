import { Badge, Button, Card, Page, inputClass } from 'sourcing-mobile-ui';

export const BoothList = () => (
  <div className="w-full bg-slate-100">
    <Page title="Stands">
      <input className={inputClass} placeholder="Fournisseur ou code du stand" />
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Phase 1 · Hall 11</h2>
        <Card className="flex items-center gap-3">
          <div className="w-28 shrink-0 font-bold">11.3J26</div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">Ningbo Bright Lighting Co.</div>
            <div className="truncate text-sm text-slate-500">Éclairage LED</div>
          </div>
          <Badge className="bg-green-100 text-green-800">Visité</Badge>
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
  </div>
);

export const WithBackAndAction = () => (
  <div className="w-full bg-slate-100">
    <Page title="Ningbo Bright Lighting Co." back action={<Button variant="secondary" className="px-3 text-sm">Modifier</Button>}>
      <Card>
        <p className="font-semibold">Ningbo Bright Lighting Co.</p>
        <p className="text-sm text-slate-600">Zhejiang · 2 stands · 50 % visité</p>
      </Card>
      <Card>
        <p className="text-sm font-medium text-slate-700">Contact</p>
        <p>Li Wei — Responsable export</p>
        <p className="text-sm text-slate-500">+86 138 0000 1234</p>
      </Card>
    </Page>
  </div>
);
