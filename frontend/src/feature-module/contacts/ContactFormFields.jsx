import { Col, Form, Input, Row, Select } from 'antd';

// Fields of the contact form, used by the supplier page and the contacts page. The server checks
// the same rules (at least a name, a phone or an e-mail; a valid e-mail) and explains a refusal.
// `suppliers` (optional) adds the supplier choice, for a new contact on the contacts page.
// D49: laid out like the Stitch "Nouveau contact" form.
export default function ContactFormFields({ suppliers }) {
  return (
    <>
      {suppliers && (
        <Form.Item name="supplier_id" label="Fournisseur rattaché" rules={[{ required: true, message: 'Choisissez le fournisseur' }]}>
          <Select showSearch optionFilterProp="label" placeholder="Sélectionner un fournisseur…"
            options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (n° ${s.supplier_no})` }))} />
        </Form.Item>
      )}
      <Form.Item name="name" label="Nom complet" extra="Renseignez au moins le nom, le téléphone ou l'e-mail">
        <Input maxLength={150} placeholder="ex. Chen Wei" />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item name="phone" label="Téléphone mobile"><Input maxLength={50} placeholder="+86 138 0000 0000" /></Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="email" label="Adresse e-mail" rules={[{ type: 'email', message: 'Adresse e-mail invalide' }]}>
            <Input maxLength={150} placeholder="contact@fournisseur.cn" />
          </Form.Item>
        </Col>
      </Row>
    </>
  );
}

// Form values -> API body: an emptied field is sent as null so it is really cleared.
export const contactPayload = (v) => ({
  name: v.name || null,
  phone: v.phone || null,
  email: v.email || null,
});
