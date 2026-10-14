import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Col, Form, Input, InputNumber, Row, Select, Switch, TreeSelect } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { categoryTree } from '../../utils/format';

// Fields of the booth form. The server checks the same rules and the overlap with
// another booth of the company (D13), and explains a refusal.
export default function BoothFormFields({ lockSupplier }) {
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
    axios.get(`${API_BASE_URL}/categories`).then((r) => setCategories(r.data.data)).catch(() => {});
  }, []);

  const tree = useMemo(() => categoryTree(categories), [categories]);

  return (
    <>
      <Form.Item name="supplier_id" label="Fournisseur" rules={[{ required: true, message: 'Choisissez un fournisseur' }]}>
        <Select showSearch optionFilterProp="label" disabled={lockSupplier} placeholder="Fournisseur"
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
      </Form.Item>
      <Form.Item name="category_id" label="Catégorie">
        <TreeSelect treeData={tree} allowClear showSearch treeNodeFilterProp="title" placeholder="Catégorie" />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={12} sm={8}>
          <Form.Item name="phase" label="Phase"><InputNumber min={1} max={9} className="w-100" /></Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="hall" label="Hall" rules={[{ required: true, message: 'Hall obligatoire' }]}>
            <InputNumber min={1} max={127} className="w-100" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="level" label="Étage"><InputNumber min={0} max={9} className="w-100" /></Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="letter" label="Lettre" rules={[{ pattern: /^[A-Za-z]$/, message: 'Une lettre' }]}>
            <Input maxLength={1} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="num_start" label="N° de début" rules={[{ required: true, message: 'Numéro obligatoire' }]}>
            <InputNumber min={1} max={9999} className="w-100" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="num_end" label="N° de fin" extra="Vide = un seul numéro">
            <InputNumber min={1} max={9999} className="w-100" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="to_visit" label="À visiter" valuePropName="checked"><Switch /></Form.Item>
      <Form.Item name="comment" label="Commentaire"><Input.TextArea rows={3} /></Form.Item>
    </>
  );
}

// Form values -> API body (antd gives undefined for empty number fields).
export const boothPayload = (v) => ({
  ...v,
  category_id: v.category_id ?? null,
  phase: v.phase ?? null,
  level: v.level ?? null,
  letter: v.letter || null,
  num_end: v.num_end ?? null,
  to_visit: !!v.to_visit,
});
