import { Badge, Card } from 'sourcing-mobile-ui';

export const Basic = () => (
  <div className="w-full bg-slate-100 p-3">
    <Card>
      <p className="font-semibold">Sami Ben Ali</p>
      <p className="text-sm text-slate-600">Groupe Tarek - Tunis · sami.benali</p>
    </Card>
  </div>
);

export const ListRow = () => (
  <div className="w-full space-y-2 bg-slate-100 p-3">
    <Card className="flex items-center gap-3">
      <div className="w-28 shrink-0 font-bold">14.3I16-17</div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">Guangzhou Homeware Ltd.</div>
        <div className="truncate text-sm text-slate-500">Articles ménagers</div>
      </div>
      <Badge className="bg-orange-100 text-orange-800">À visiter</Badge>
    </Card>
    <Card className="flex items-center gap-3">
      <div className="w-28 shrink-0 font-bold">9.1</div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">Sans fournisseur</div>
        <div className="truncate text-sm text-slate-500">Sans catégorie</div>
      </div>
      <Badge className="bg-green-100 text-green-800">Visité</Badge>
    </Card>
  </div>
);

export const Product = () => (
  <div className="w-full bg-slate-100 p-3">
    <Card className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">Lampe LED solaire 20 W</p>
        <p className="font-bold text-blue-700">3,80</p>
      </div>
      <p className="text-sm text-slate-600">MOQ 500 pièce · FOB</p>
      <p className="text-sm text-slate-500">Partagé avec : Groupe Tarek - Sfax</p>
    </Card>
  </div>
);
