import { Col, Form, Input, Row, Select } from 'antd';
import CardScanButton from '../../components/CardScanButton';
import AvatarField from './AvatarField';

// "Scanner une carte de visite" (D37, D52): fills the empty fields of the form around it, under
// the field names `prefix + name|phone|email|wechat_qr` (a WeChat id is kept like a QR code that
// holds no link, D34). Returns the fields found, for a form that also uses the company.
export function CardScan({ prefix = '', onRead }) {
  const form = Form.useFormInstance();
  return (
    <CardScanButton onRead={(card) => {
      const now = form.getFieldsValue();
      const fill = {};
      [['name', card.name], ['phone', card.phone], ['email', card.email], ['wechat_qr', card.wechat]].forEach(([key, value]) => {
        if (value && !now[prefix + key]) fill[prefix + key] = value;
      });
      form.setFieldsValue(fill);
      onRead?.(card, now);
    }} />
  );
}

// Fields of the contact form, used by the supplier page and the contacts page. The server checks
// the same rules (at least a name, a phone or an e-mail; a valid e-mail) and explains a refusal.
// `suppliers` (optional) adds the supplier choice, for a new contact on the contacts page.
// `scan` shows the business-card scan without that choice (the supplier form already knows who).
export default function ContactFormFields({ suppliers, scan = false }) {
  const name = Form.useWatch('name');
  return (
    <>
      {(suppliers || scan) && <CardScan />}
      {suppliers && (
        <Form.Item name="supplier_id" label="Fournisseur rattaché" rules={[{ required: true, message: 'Choisissez le fournisseur' }]}>
          <Select showSearch optionFilterProp="label" placeholder="Sélectionner un fournisseur…"
            options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (n° ${s.supplier_no})` }))} />
        </Form.Item>
      )}
      {/* D63: the contact's photo, stored as Base64. */}
      <Form.Item name="avatar" label="Photo du contact">
        <AvatarField name={name} />
      </Form.Item>
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
  avatar: v.avatar || null, // D63
});
