import { useState } from 'react';
import type { ContactValues } from '../contact';
import { isQrLink, useQrImage } from '../qr';
import QrScanner from './QrScanner';
import { Button, Field, inputClass } from './ui';

// The contact fields of the mobile forms (new contact, new supplier from a business card). The
// WeChat QR code is scanned right here, before saving: its content goes in `wechat` and is
// saved with the contact (saveContact, D34).
export function ContactFields({ values, onChange }: { values: ContactValues; onChange: (v: ContactValues) => void }) {
  const [scanning, setScanning] = useState(false);
  const qr = useQrImage(isQrLink(values.wechat) ? values.wechat : null);
  const set = (key: keyof ContactValues) => (e: { target: { value: string } }) => onChange({ ...values, [key]: e.target.value });
  return (
    <>
      <Field label="Nom du contact"><input className={inputClass} value={values.name} onChange={set('name')} maxLength={150} /></Field>
      <Field label="Téléphone"><input className={inputClass} value={values.phone} onChange={set('phone')} maxLength={50} inputMode="tel" /></Field>
      <Field label="E-mail"><input className={inputClass} value={values.email} onChange={set('email')} maxLength={150} inputMode="email" autoCapitalize="none" /></Field>
      <div className="space-y-2">
        <span className="block text-sm font-medium text-slate-700">WeChat</span>
        {qr ? (
          <div className="flex items-center gap-3">
            <img src={qr} alt="QR code WeChat" className="h-28 w-28 rounded-lg border bg-white object-contain" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="break-all text-xs text-slate-500">{values.wechat}</p>
              <button type="button" className="text-sm font-medium text-red-600" onClick={() => onChange({ ...values, wechat: '' })}>Retirer</button>
            </div>
          </div>
        ) : (
          <input className={inputClass} value={values.wechat} onChange={set('wechat')} maxLength={255} autoCapitalize="none"
            placeholder="Identifiant WeChat, ou scannez le QR code" aria-label="Identifiant WeChat" />
        )}
        <Button type="button" variant="secondary" className="w-full" onClick={() => setScanning(true)}>
          {qr ? 'Scanner un autre QR WeChat' : 'Scanner le QR WeChat'}
        </Button>
      </div>
      {scanning && (
        <QrScanner onClose={() => setScanning(false)}
          saveLabel="Utiliser ce QR code"
          onSave={async (content) => { onChange({ ...values, wechat: content }); setScanning(false); }} />
      )}
    </>
  );
}
