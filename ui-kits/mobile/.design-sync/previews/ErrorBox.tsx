import { ErrorBox } from 'sourcing-mobile-ui';

export const ServerMessage = () => (
  <div className="w-full">
    <ErrorBox message="Ce stand existe déjà pour cette phase." />
  </div>
);

export const LongMessage = () => (
  <div className="w-full">
    <ErrorBox message="Identifiant ou mot de passe incorrect. Votre compte doit être validé par l'administrateur avant la première connexion." />
  </div>
);
