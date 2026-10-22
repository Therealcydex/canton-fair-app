import { useEffect, useState } from 'react';
import axios from 'axios';
import { Col, Form, Input, Rate, Row, Select } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { companyLabel, useList } from '../../utils/lists';
import { CANTON_FAIR_URL } from '../../utils/fairPlan';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/access';
import { CardScan } from '../contacts/ContactFormFields';
import { QrPicker } from './WechatQr';

// Fields of the supplier form; the server checks the same rules (name required, 1-5 rating…).
// `withContact` (new supplier, D52): the business card scan and the first contact, as on the fair
// floor: the company and the website go to the supplier, the person to the contact.
// D66: the admin's form also has "Partager avec", the companies whose viewers read the supplier.
export default function SupplierFormFields({ withContact = false }) {
  const provinces = useList('provinces');
  const form = Form.useFormInstance();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    if (admin) axios.get(`${API_BASE_URL}/companies`).then((r) => setCompanies(r.data.data)).catch(() => {});
  }, [admin]);
  return (
    <>
      {withContact && (
        <CardScan prefix="contact_" onRead={(card, now) => {
          const fill = {};
          if (card.company && !now.name) fill.name = card.company;
          if (card.website && !now.website) fill.website = card.website;
          form.setFieldsValue(fill);
        }} />
      )}
      <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est obligatoire' }]}>
        <Input maxLength={200} />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item name="phone" label="Téléphone"><Input maxLength={50} /></Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="email" label="E-mail" rules={[{ type: 'email', message: 'Adresse e-mail invalide' }]}>
            <Input maxLength={150} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="website" label="Site web"><Input maxLength={255} /></Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="province_id" label="Province">
            <Select allowClear showSearch optionFilterProp="label" placeholder="Province chinoise"
              options={provinces.map((p) => ({ value: p.id, label: `${p.name_en} ${p.name_zh}` }))} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="cantonfair_url" label="Page sur le site du salon"
        extra="Copiez l'adresse de la page de l'exposant sur cantonfair.org.cn"
        rules={[{ pattern: CANTON_FAIR_URL, message: 'Adresse du site cantonfair.org.cn attendue (https://…)' }]}>
        <Input maxLength={255} placeholder="https://www.cantonfair.org.cn/…" />
      </Form.Item>
      <Form.Item name="address" label="Adresse"><Input.TextArea rows={2} /></Form.Item>
      <Form.Item name="rating" label="Note"><Rate allowClear /></Form.Item>
      <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
      {admin && (
        <Form.Item name="share_company_ids" label="Partager avec"
          extra="Les lecteurs de ces sociétés verront ce fournisseur, ses contacts, booths et produits, en lecture seule.">
          <Select mode="multiple" allowClear showSearch optionFilterProp="label" placeholder="Aucune société"
            options={companies.map((c) => ({ value: c.id, label: companyLabel(c) }))} />
        </Form.Item>
      )}
      {withContact && (
        <>
          <h3 className="h6 mt-2">Contact <span className="fw-normal small text-secondary">(facultatif)</span></h3>
          <Form.Item name="contact_name" label="Nom du contact"><Input maxLength={150} /></Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="contact_phone" label="Téléphone mobile"><Input maxLength={50} inputMode="tel" /></Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="contact_email" label="E-mail" rules={[{ type: 'email', message: 'Adresse e-mail invalide' }]}>
                <Input maxLength={150} inputMode="email" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="contact_wechat_qr" label="QR code WeChat" className="mb-0"><QrPicker /></Form.Item>
        </>
      )}
    </>
  );
}

// The contact typed in a new supplier's form, or null when it is empty.
export const newSupplierContact = (v) => {
  const contact = { name: v.contact_name || null, phone: v.contact_phone || null, email: v.contact_email || null };
  return contact.name || contact.phone || contact.email || v.contact_wechat_qr ? { ...contact, wechat_qr: v.contact_wechat_qr || null } : null;
};
