import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Cascader, Col, Form, Input, InputNumber, Row, Select, Switch } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { categoryOptions, useList } from '../../utils/lists';

// Fields of the booth form. The server checks the same rules (phase 1-3, floor 1-4, letter A-Z,
// a category of the booth's phase) and refuses a booth that overlaps another one (D26).
export default function BoothFormFields({ lockSupplier }) {
  const [suppliers, setSuppliers] = useState([]);
  const categories = useList('canton-categories');
  const phase = Form.useWatch('phase');

  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
  }, []);

  // The Canton Fair categories are per phase: only those of the chosen phase are offered.
  const options = useMemo(() => categoryOptions(categories, phase), [categories, phase]);

  return (
    <>
      <Form.Item name="supplier_id" label="Fournisseur">
        <Select showSearch allowClear optionFilterProp="label" disabled={lockSupplier} placeholder="Aucun"
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={12} sm={8}>
          <Form.Item name="phase" label="Phase" rules={[{ required: true, message: 'Phase obligatoire' }]}>
            <Select options={[1, 2, 3].map((n) => ({ value: n, label: `Phase ${n}` }))} />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="hall" label="Hall" rules={[{ required: true, message: 'Hall obligatoire' }]}>
            <InputNumber min={1} max={127} className="w-100" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="floor" label="Étage" rules={[{ required: true, message: 'Étage obligatoire' }]}>
            <Select options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="letter" label="Lettre"
            rules={[{ required: true, message: 'Lettre obligatoire' }, { pattern: /^[A-Za-z]$/, message: 'Une lettre de A à Z' }]}>
            <Input maxLength={1} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="num_start" label="N° de début" rules={[{ required: true, message: 'Numéro obligatoire' }]}>
            <InputNumber min={1} max={32767} className="w-100" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="num_end" label="N° de fin" extra="Vide = un seul numéro">
            <InputNumber min={1} max={32767} className="w-100" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="category_path" label="Catégorie (salon de Canton)"
        extra={phase ? (options.length ? '' : `Pas de catégories pour la phase ${phase}`) : 'Choisissez d\'abord la phase'}>
        <Cascader options={options} allowClear showSearch disabled={!options.length}
          placeholder="Catégorie / section / sous-catégorie" />
      </Form.Item>
      <Form.Item name="visited" label="Visité" valuePropName="checked"><Switch /></Form.Item>
      <Form.Item name="comment" label="Commentaire"><Input.TextArea rows={3} /></Form.Item>
    </>
  );
}

// Form values -> API body (antd gives undefined for empty fields; the cascader gives a path).
export const boothPayload = ({ category_path, ...v }) => ({
  ...v,
  supplier_id: v.supplier_id ?? null,
  category_id: category_path?.[2] ?? null,
  num_end: v.num_end ?? null,
  letter: (v.letter || '').toUpperCase(),
  visited: !!v.visited,
});
