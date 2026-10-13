import { Col, Form, Input, Rate, Row } from 'antd';

// Fields of the supplier form; the server checks the same rules (name required, 1-5 rating…).
export default function SupplierFormFields() {
  return (
    <>
      <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est obligatoire' }]}>
        <Input maxLength={150} />
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
          <Form.Item name="website" label="Site web"><Input maxLength={200} /></Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="province" label="Province"><Input maxLength={100} /></Form.Item>
        </Col>
      </Row>
      <Form.Item name="address" label="Adresse"><Input.TextArea rows={2} /></Form.Item>
      <Form.Item name="rating" label="Note"><Rate allowClear /></Form.Item>
      <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
    </>
  );
}
