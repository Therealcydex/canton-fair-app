import { useEffect, useState } from 'react';
import axios from 'axios';
import { Col, Form, Input, InputNumber, Row, Select } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { useList } from '../../utils/lists';

// Fields of the product form. The server checks the same rules (price with 2 decimals at most,
// a shipping type of the list) and explains a refusal.
export default function ProductFormFields({ lockSupplier }) {
  const [suppliers, setSuppliers] = useState([]);
  const shippingTypes = useList('shipping-types');

  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
  }, []);

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
  price: v.price ? String(v.price).replace(',', '.') : null,
  moq: v.moq ?? null,
});
