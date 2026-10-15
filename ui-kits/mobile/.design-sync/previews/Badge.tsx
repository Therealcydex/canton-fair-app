import { Badge } from 'sourcing-mobile-ui';

export const Status = () => (
  <div className="flex flex-wrap gap-2">
    <Badge className="bg-green-100 text-green-800">Visité</Badge>
    <Badge className="bg-orange-100 text-orange-800">À visiter</Badge>
  </div>
);

export const Tones = () => (
  <div className="flex flex-wrap gap-2">
    <Badge className="bg-blue-100 text-blue-800">FOB</Badge>
    <Badge className="bg-slate-200 text-slate-700">Phase 2</Badge>
    <Badge className="bg-amber-100 text-amber-900">En attente</Badge>
    <Badge className="bg-red-100 text-red-800">Inactif</Badge>
  </div>
);
