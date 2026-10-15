import type { ContactValues } from '../contact';
import { Field, inputClass } from './ui';

// The contact fields of the mobile forms (new contact, new supplier from a business card).
export function ContactFields({ values, onChange }: { values: ContactValues; onChange: (v: ContactValues) => void }) {
  const set = (key: keyof ContactValues) => (e: { target: { value: string } }) => onChange({ ...values, [key]: e.target.value });
  return (
    <>
      <Field label="Nom du contact"><input className={inputClass} value={values.name} onChange={set('name')} maxLength={150} /></Field>
      <Field label="Téléphone"><input className={inputClass} value={values.phone} onChange={set('phone')} maxLength={50} inputMode="tel" /></Field>
      <Field label="E-mail"><input className={inputClass} value={values.email} onChange={set('email')} maxLength={150} inputMode="email" autoCapitalize="none" /></Field>
      <Field label="WeChat (identifiant)" hint="Le QR code WeChat peut aussi être scanné ensuite">
        <input className={inputClass} value={values.wechat} onChange={set('wechat')} maxLength={255} autoCapitalize="none" />
      </Field>
    </>
  );
}
