import { Notice } from 'sourcing-mobile-ui';

export const Success = () => (
  <div className="w-full">
    <Notice message="Produit enregistré." />
  </div>
);

export const SignUpPending = () => (
  <div className="w-full">
    <Notice message="Inscription envoyée. L'administrateur doit valider votre compte avant que vous puissiez vous connecter." />
  </div>
);
