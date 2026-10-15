import { Button } from 'sourcing-mobile-ui';

export const Variants = () => (
  <div className="flex flex-wrap gap-2">
    <Button>Enregistrer</Button>
    <Button variant="secondary">Annuler</Button>
    <Button variant="danger">Supprimer</Button>
  </div>
);

export const Disabled = () => (
  <div className="flex flex-wrap gap-2">
    <Button disabled>Enregistrement…</Button>
    <Button variant="secondary" disabled>Annuler</Button>
  </div>
);

export const FullWidth = () => (
  <div className="w-full space-y-2">
    <Button className="w-full" type="submit">Se connecter</Button>
    <Button variant="secondary" className="w-full">Se déconnecter</Button>
  </div>
);
