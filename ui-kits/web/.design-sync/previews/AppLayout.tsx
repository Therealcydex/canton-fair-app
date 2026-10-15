import { AppLayout, Link, Route, Routes, antd } from 'sourcing-web-ui';

const { Button, Input, Rate, Select, Space, Table } = antd;

const suppliers = [
  { id: 1, name: 'Ningbo Bright Lighting Co.', province: 'Zhejiang', phone: '+86 574 8888 1234', rating: 4, contacts_count: 2, nbr_booths: 2, booth_visit_pct: 50, products_count: 5 },
  { id: 2, name: 'Foshan Sunway Electric', province: 'Guangdong', phone: '+86 757 2222 9876', rating: 3, contacts_count: 1, nbr_booths: 1, booth_visit_pct: 100, products_count: 2 },
  { id: 3, name: 'Guangzhou Homeware Ltd.', province: 'Guangdong', phone: null, rating: null, contacts_count: 0, nbr_booths: 1, booth_visit_pct: 0, products_count: 0 },
];

const columns = [
  { title: 'Nom', dataIndex: 'name', render: (v: string, r: { id: number }) => <Link to={`/fournisseurs/${r.id}`}>{v}</Link> },
  { title: 'Province', dataIndex: 'province' },
  { title: 'Téléphone', dataIndex: 'phone', render: (v: string | null) => v || '—' },
  { title: 'Note', dataIndex: 'rating', width: 150, render: (v: number | null) => (v ? <Rate disabled value={v} /> : '—') },
  { title: 'Stands', dataIndex: 'nbr_booths', width: 80 },
  { title: 'Visités', dataIndex: 'booth_visit_pct', width: 90, render: (v: number) => `${v} %` },
  { title: 'Produits', dataIndex: 'products_count', width: 90 },
];

export const SuppliersScreen = () => (
  <Routes>
    <Route element={<AppLayout />}>
      <Route path="*" element={
        <>
          <Space className="mb-3 w-100 justify-content-between" wrap>
            <h1 className="h4 m-0">Fournisseurs</h1>
            <Button type="primary">Nouveau fournisseur</Button>
          </Space>
          <Space className="mb-3" wrap>
            <Input.Search placeholder="Rechercher par nom" allowClear style={{ width: 260 }} />
            <Select placeholder="Province" allowClear style={{ width: 200 }}
              options={[{ value: 1, label: 'Guangdong' }, { value: 2, label: 'Zhejiang' }]} />
          </Space>
          <Table rowKey="id" columns={columns} dataSource={suppliers} size="middle" pagination={false} />
        </>
      } />
    </Route>
  </Routes>
);
