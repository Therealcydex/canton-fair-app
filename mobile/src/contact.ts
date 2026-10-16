// A contact typed or read from a business card (D37), and how it is saved.
import { api, jsonBody } from './config/api';

export interface ContactValues {
  name: string;
  phone: string;
  email: string;
  wechat: string;
}

export const emptyContact: ContactValues = { name: '', phone: '', email: '', wechat: '' };

// Creates the contact, then its WeChat id when there is one (stored like a scanned QR code that
// holds no link, D34). The server checks everything and explains a refusal.
export async function saveContact(supplierId: number, v: ContactValues): Promise<number> {
  const created = await api<{ id: number }>(`/suppliers/${supplierId}/contacts`, "Erreur lors de l'enregistrement du contact", {
    method: 'POST',
    body: jsonBody({ name: v.name.trim() || null, phone: v.phone.trim() || null, email: v.email.trim() || null }),
  });
  if (v.wechat.trim()) {
    await api(`/suppliers/${supplierId}/contacts/${created.id}/wechat-qr`, "Contact enregistré, mais pas son WeChat", {
      method: 'PUT',
      body: jsonBody({ content: v.wechat.trim() }),
    });
  }
  return created.id;
}
