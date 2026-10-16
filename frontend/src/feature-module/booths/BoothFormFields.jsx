import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Cascader, Col, Form, Input, InputNumber, Row, Select, Switch } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { categoryOptions, useList } from '../../utils/lists';
import { hallsOf, useFairPlan } from '../../utils/fairPlan';

// Fields of the booth form. The server checks the same rules (phase 1-3, floor 1-4, letter A-Z,
// letter and number together (D32), a category of the booth's phase) and refuses a booth that
// overlaps another one (D26).

const empty = (x) => x === undefined || x === null || x === '';

// D32: the letter and the start number are both given or both left empty.
const together = (other, message) => ({ getFieldValue }) => ({
  validator: (_, value) =>
    (empty(value) && !empty(getFieldValue(other)) ? Promise.reject(new Error(message)) : Promise.resolve()),
});

// The code the server will build, as the fair prints it: hall.floor + aisle letter + booth
// number(s) on 2 digits (D32, D50): "1.1D22", "10.3A08-23", "9.1" (hall and floor only).
const two = (n) => String(n).padStart(2, '0');
const previewCode = ({ hall, floor, letter, num_start: start, num_end: end }) => {
  if (empty(hall) || empty(floor)) return '—';
  if (empty(letter) || empty(start)) return `${hall}.${floor}`;
  return `${hall}.${floor}${letter.toUpperCase()}${two(start)}${empty(end) || end === start ? '' : `-${two(end)}`}`;
};

// D50: the zone of a hall, as on the fair's plan (A = halls 1-8, B = 9-13, C = 14-16, D = 17-21).
const zoneOf = (hall) => (hall >= 1 && hall <= 8 ? 'A' : hall <= 13 && hall >= 9 ? 'B'
  : hall >= 14 && hall <= 16 ? 'C' : hall >= 17 && hall <= 21 ? 'D' : null);

// "Zone A · hall 1, étage 1 · allée D · booth 22", read from the fields while typing.
const describe = ({ hall, floor, letter, num_start: start, num_end: end }) => {
  if (empty(hall) || empty(floor)) return '';
  const parts = [zoneOf(hall) && `Zone ${zoneOf(hall)}`, `hall ${hall}, étage ${floor}`];
  if (!empty(letter) && !empty(start)) {
    parts.push(`allée ${letter.toUpperCase()}`, empty(end) || end === start ? `booth ${two(start)}` : `booths ${two(start)} à ${two(end)}`);
  }
  return parts.filter(Boolean).join(' · ');
};

export default function BoothFormFields({ lockSupplier }) {
  const [suppliers, setSuppliers] = useState([]);
  const categories = useList('canton-categories');
  const phase = Form.useWatch('phase');
  const categoryPath = Form.useWatch('category_path');
  const plan = useFairPlan();
  // D42: the halls of the chosen section, from the hall plan.
  const sectionHalls = categoryPath?.[1] ? hallsOf(plan, phase, categoryPath[1]) : null;

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
          <Form.Item name="letter" label="Allée (lettre)" dependencies={['num_start']}
            rules={[{ pattern: /^[A-Za-z]$/, message: 'Une lettre de A à Z' }, together('num_start', 'Donnez aussi la lettre')]}>
            <Input maxLength={1} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="num_start" label="N° du booth" dependencies={['letter']}
            rules={[together('letter', 'Donnez aussi le numéro')]}>
            <InputNumber min={1} max={32767} className="w-100" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item name="num_end" label="Jusqu'au n°" extra="Vide = un seul booth">
            <InputNumber min={1} max={32767} className="w-100" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item noStyle shouldUpdate>
        {({ getFieldsValue }) => (
          <div className="text-muted mb-3">Code du booth : <b>{previewCode(getFieldsValue())}</b>
            {describe(getFieldsValue()) && <> — {describe(getFieldsValue())}</>}
            <div className="small">Comme sur le badge du salon : 1.1D22, 10.3A08-23 ; allée et numéro vides = seulement le hall et l'étage (9.1).</div></div>
        )}
      </Form.Item>
      <Form.Item name="category_path" label="Catégorie (salon de Canton)"
        extra={phase
          ? (options.length ? (sectionHalls ? `Halls de cette section : ${sectionHalls}` : '') : `Pas de catégories pour la phase ${phase}`)
          : 'Choisissez d\'abord la phase'}>
        <Cascader options={options} allowClear showSearch disabled={!options.length}
          placeholder="Catégorie / section / sous-catégorie" />
      </Form.Item>
      <Form.Item name="visited" label="Visité" valuePropName="checked"><Switch /></Form.Item>
      <Form.Item name="comment" label="Commentaire"><Input.TextArea rows={3} /></Form.Item>
    </>
  );
}

// Form values -> API body (antd gives undefined for empty fields; the cascader gives a path).
// Empty fields are sent as null: undefined would drop them and the server would keep the old value.
export const boothPayload = ({ category_path, ...v }) => ({
  ...v,
  supplier_id: v.supplier_id ?? null,
  category_id: category_path?.[2] ?? null,
  num_start: v.num_start ?? null,
  num_end: v.num_end ?? null,
  letter: v.letter ? v.letter.toUpperCase() : null,
  visited: !!v.visited,
});
