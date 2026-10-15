import { useState } from 'react';
import { FormModal, antd } from 'sourcing-web-ui';

const { Col, ConfigProvider, Form, Input, Rate, Row, Select } = antd;

// The modal is mounted inside the card (getPopupContainer) instead of document.body.
const InCard = ({ children }: { children: React.ReactNode }) => {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setEl} style={{ position: 'relative', width: 720, height: 680, transform: 'translateZ(0)' }}>
      {el && <ConfigProvider getPopupContainer={() => el}>{children}</ConfigProvider>}
    </div>
  );
};

export const NewSupplier = () => (
  <InCard>
  <FormModal open title="Nouveau fournisseur" width={640}
    initialValues={{ name: 'Ningbo Bright Lighting Co.', province_id: 2, rating: 4 }}
    onSubmit={async () => null} onCancel={() => {}}>
    <Form.Item name="name" label="Nom" rules={[{ required: true, message: 'Le nom est obligatoire' }]}>
      <Input maxLength={200} />
    </Form.Item>
    <Row gutter={12}>
      <Col xs={24} sm={12}>
        <Form.Item name="phone" label="Téléphone"><Input maxLength={50} /></Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="email" label="E-mail"><Input maxLength={150} /></Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="website" label="Site web"><Input maxLength={255} /></Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="province_id" label="Province">
          <Select allowClear placeholder="Province chinoise"
            options={[{ value: 1, label: 'Guangdong 广东' }, { value: 2, label: 'Zhejiang 浙江' }]} />
        </Form.Item>
      </Col>
    </Row>
    <Form.Item name="rating" label="Note"><Rate allowClear /></Form.Item>
    <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
  </FormModal>
  </InCard>
);
