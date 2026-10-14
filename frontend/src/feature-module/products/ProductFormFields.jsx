import { useEffect, useState } from 'react';
import axios from 'axios';
import { Col, Form, Input, InputNumber, Row, Select } from 'antd';
import { API_BASE_URL } from '../../config/config';

// Fields of the product form. The booth list follows the chosen supplier: the server
// refuses a booth of another supplier (D19).
export default function ProductFormFields({ lockSupplier }) {
  const form = Form.useFormInstance();
  const [suppliers, setSuppliers] = useState([]);
  const [booths, setBooths] = useState([]);
  const [incoterms, setIncoterms] = useState([]);
  const supplierId = Form.useWatch('supplier_id', form);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
    axios.get(`${API_BASE_URL}/products/incoterms`).then((r) => setIncoterms(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!supplierId) { setBooths([]); return; }
    axios.get(`${API_BASE_URL}/booths`, { params: { supplier_id: supplierId } })
      .then((r) => setBooths(r.data.data)).catch(() => setBooths([]));
  }, [supplierId]);

  return (
    <>
      <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est obligatoire' }]}>
        <Input maxLength={150} />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item name="supplier_id" label="Fournisseur" rules={[{ required: true, message: 'Choisissez un fournisseur' }]}>
            <Select showSearch optionFilterProp="label" disabled={lockSupplier} placeholder="Fournisseur"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              onChange={() => form.setFieldValue('booth_id', null)} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="booth_id" label="Stand" extra={supplierId && booths.length === 0 ? 'Aucun stand pour ce fournisseur' : ''}>
            <Select allowClear placeholder="Stand (facultatif)" disabled={!supplierId}
              options={booths.map((b) => ({ value: b.id, label: `${b.location}${b.phase ? ` · phase ${b.phase}` : ''}` }))} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="supplier_ref" label="Référence fournisseur"><Input maxLength={100} /></Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="price_tnd" label="Prix (TND)"
            rules={[{ pattern: /^\d{1,9}([.,]\d{1,3})?$/, message: 'Montant positif, 3 décimales au plus' }]}>
            <Input inputMode="decimal" placeholder="12,500" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="unit" label="Unité"><Input maxLength={30} placeholder="pièce, carton…" /></Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="moq" label="MOQ"><InputNumber min={1} className="w-100" /></Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="incoterm" label="Incoterm">
            <Select allowClear options={incoterms.map((i) => ({ value: i, label: i }))} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="description" label="Description"><Input.TextArea rows={4} /></Form.Item>
    </>
  );
}

// Form values -> API body: empty optional fields are sent as null so they can be cleared.
export const productPayload = (v) => ({
  ...v,
  booth_id: v.booth_id ?? null,
  price_tnd: v.price_tnd ? String(v.price_tnd).replace(',', '.') : null,
  moq: v.moq ?? null,
  incoterm: v.incoterm ?? null,
});
