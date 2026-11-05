import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Alert, Button, Empty, Select, Spin, Table } from 'antd';
import { DownloadOutlined, FilePdfOutlined, ReloadOutlined } from '@ant-design/icons';
import { API_BASE_URL, fileUrl } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { useStickyState } from '../../utils/place';
import PageHeader from '../../components/PageHeader';

// D76/D77: every supplier PDF on disk, opened from the sidebar under Galerie.
export default function Catalogues() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useStickyState('filters:catalogues', {});

  useEffect(() => {
    axios.get(`${API_BASE_URL}/suppliers`).then((r) => setSuppliers(r.data.data)).catch(() => {});
  }, []);
  useEffect(() => {
    setError(null);
    const params = {};
    if (filters.supplier_ids?.length) params.supplier_ids = filters.supplier_ids.join(',');
    axios.get(`${API_BASE_URL}/suppliers/catalogs`, { params })
      .then((r) => setRows(r.data.data))
      .catch((err) => { setRows([]); setError(apiError(err, 'Erreur lors du chargement des catalogues')); });
  }, [filters]);

  const supplierCount = new Set((rows || []).map((r) => r.supplier_id)).size;
  const counts = rows
    ? ` · ${rows.length} catalogue${rows.length > 1 ? 's' : ''} · ${supplierCount} fournisseur${supplierCount > 1 ? 's' : ''}`
    : '';

  return (
    <>
      <PageHeader title="Catalogues" chip="PDF" subtitle={`Catalogues des fournisseurs${counts}`} />
      <div className="sc-filters">
        <Select prefix={<span className="sc-label">Fournisseur :</span>} placeholder="Tous" allowClear mode="multiple"
          showSearch optionFilterProp="label" style={{ minWidth: 260 }} value={filters.supplier_ids}
          onChange={(value) => setFilters((f) => ({ ...f, supplier_ids: value?.length ? value : undefined }))}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Button type="link" icon={<ReloadOutlined />} className="fw-semibold px-1"
          onClick={() => setFilters({})}>Réinitialiser</Button>
      </div>
      {error && <Alert type="error" showIcon className="mb-3" message={error} />}
      {rows === null ? <div className="text-center py-5"><Spin /></div> : (
        <Table rowKey="id" size="middle" dataSource={rows} scroll={{ x: true }}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucun catalogue" /> }}
          columns={[
            {
              title: 'Catalogue', dataIndex: 'file_name',
              render: (name) => (
                <span className="d-inline-flex align-items-center gap-2">
                  <FilePdfOutlined className="text-danger" />
                  <span className="fw-medium">{name}</span>
                </span>
              ),
            },
            {
              title: 'Fournisseur', dataIndex: 'supplier_name',
              render: (name, row) => <Link to={`/fournisseurs/${row.supplier_id}?tab=catalogue`}>{name}</Link>,
            },
            {
              title: '', key: 'actions', width: 140, align: 'right',
              render: (_, row) => (
                <Button size="small" icon={<DownloadOutlined />} href={fileUrl(row.file_url)}
                  download={row.file_name} target="_blank" rel="noreferrer">
                  Télécharger
                </Button>
              ),
            },
          ]} />
      )}
    </>
  );
}
