import { Form, Input, Select } from 'antd';

// Fields of the contact form, used by the supplier page and the contacts page. The server checks
// the same rules (at least a name, a phone or an e-mail; a valid e-mail) and explains a refusal.
// `suppliers` (optional) adds the supplier choice, for a new contact on the contacts page.
export default function ContactFormFields({ suppliers }) {
  return (
    <>
      {suppliers && (
        <Form.Item name="supplier_id" label="Fournisseur" rules={[{ required: true, message: 'Choisissez le fournisseur' }]}>
          <Select showSearch optionFilterProp="label" placeholder="Fournisseur"
            options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (n° ${s.id})` }))} />
        </Form.Item>
      )}
      <Form.Item name="name" label="Nom" extra="Renseignez au moins le nom, le téléphone ou l'e-mail">
        <Input maxLength={150} />
      </Form.Item>
      <Form.Item name="phone" label="Téléphone"><Input maxLength={50} /></Form.Item>
      <Form.Item name="email" label="E-mail" rules={[{ type: 'email', message: 'Adresse e-mail invalide' }]}>
        <Input maxLength={150} />
      </Form.Item>
    </>
  );
}

// Form values -> API body: an emptied field is sent as null so it is really cleared.
export const contactPayload = (v) => ({
  name: v.name || null,
  phone: v.phone || null,
  email: v.email || null,
});
