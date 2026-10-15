import { Card, Loading } from 'sourcing-mobile-ui';

export const InList = () => (
  <div className="w-full space-y-3 bg-slate-100 p-3">
    <Card>
      <p className="font-semibold">Fournisseurs</p>
      <p className="text-sm text-slate-600">Liste partagée par tout le groupe</p>
    </Card>
    <Loading />
  </div>
);
