import { useEffect, useState } from 'react';
import axios from 'axios';
import { Col, Form, Input, InputNumber, Row, Select } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { useList } from '../../utils/lists';
import { boothLabel } from '../../utils/format';

// Fields of the product form. The server checks the same rules (price with 2 decimals at most,
// a shipping type of the list) and explains a refusal.
export default function ProductFormFields({ lockSupplier }) {
  const [suppliers, setSuppliers] = useState([]);
  const [booths, setBooths] = useState([]);
  const shippingTypes = useList('shipping-types');
  const form = Form.useFormInstance();
  const supplierId = Form.useWatch('supplier_id');

  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
  }, []);

  // D43: the booth where the product was found, among the booths of the chosen supplier. A booth
  // of another supplier is cleared when the supplier changes (the server refuses it anyway).
  useEffect(() => {
    if (!supplierId) { setBooths([]); return undefined; }
    let alive = true;
    axios.get(`${API_BASE_URL}/booths`, { params: { supplier_id: supplierId } }).then((r) => {
      if (!alive) return;
      setBooths(r.data.data);
      const current = form.getFieldValue('booth_id');
      if (current && !r.data.data.some((b) => b.id === current)) form.setFieldValue('booth_id', null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [supplierId, form]);

  return (
    <>
      <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est obligatoire' }]}>
        <Input maxLength={200} />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item name="supplier_id" label="Fournisseur">
            <Select showSearch allowClear optionFilterProp="label" disabled={lockSupplier} placeholder="Aucun"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="booth_id" label="Booth" extra={supplierId ? (booths.length ? '' : "Ce fournisseur n'a pas de booth") : "Choisissez d'abord le fournisseur"}>
            <Select allowClear placeholder="Non précisé" disabled={!booths.length}
              options={booths.map((b) => ({ value: b.id, label: boothLabel(b.phase, b.booth_code) }))} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="supplier_ref" label="Référence fournisseur"><Input maxLength={100} /></Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="price" label="Prix"
            rules={[{ pattern: /^\d{1,10}([.,]\d{1,2})?$/, message: 'Montant positif, 2 décimales au plus' }]}>
            <Input inputMode="decimal" placeholder="12,50" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="shipping_type" label="Type d'expédition (Incoterm)">
            <Select options={shippingTypes.map((s) => ({ value: s.code, label: `${s.code} — ${s.name}` }))} />
          </Form.Item>
        </Col>
        <Col xs={12}>
          <Form.Item name="unit" label="Unité"><Input maxLength={30} placeholder="pièce, carton…" /></Form.Item>
        </Col>
        <Col xs={12}>
          <Form.Item name="moq" label="MOQ"><InputNumber min={1} className="w-100" /></Form.Item>
        </Col>
      </Row>
      <Form.Item name="description" label="Description"><Input.TextArea rows={4} /></Form.Item>
    </>
  );
}

// Form values -> API body: empty optional fields are sent as null so they can be cleared.
export const productPayload = (v) => ({
  ...v,
  supplier_id: v.supplier_id ?? null,
  booth_id: v.booth_id ?? null,
  price: v.price ? String(v.price).replace(',', '.') : null,
  moq: v.moq ?? null,
});
