import { Col, Form, Input, Rate, Row, Select } from 'antd';
import { useList } from '../../utils/lists';
import { CANTON_FAIR_URL } from '../../utils/fairPlan';

// Fields of the supplier form; the server checks the same rules (name required, 1-5 rating…).
export default function SupplierFormFields() {
  const provinces = useList('provinces');
  return (
    <>
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
    </>
  );
}
