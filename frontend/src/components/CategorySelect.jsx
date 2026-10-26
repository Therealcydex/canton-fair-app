import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { App, Button, Form, Input, Select } from 'antd';
import { API_BASE_URL } from '../config/config';
import { apiError } from '../utils/apiError';

// A multi-select of names from a one-column category list. "Nouvelle catégorie" adds the name
// to that list and selects it. The button runs on mouse down: a click inside the open list is
// otherwise swallowed before "Ajouter" can run, and the field never receives what was typed.
export default function CategorySelect({ name, listPath, multiple = true }) {
  const { message } = App.useApp();
  const form = Form.useFormInstance();
  const busy = useRef(false);
  const [options, setOptions] = useState([]);
  const [adding, setAdding] = useState('');
  useEffect(() => {
    axios.get(`${API_BASE_URL}${listPath}`).then((r) => setOptions(r.data.data)).catch(() => {});
  }, [listPath]);

  const add = async () => {
    const label = adding.trim();
    if (!label || busy.current) return;
    busy.current = true;
    try {
      const { data } = await axios.post(`${API_BASE_URL}${listPath}`, { name: label });
      const saved = data.data.name;
      setOptions((rows) => (rows.some((r) => r.name === saved)
        ? rows
        : [...rows, { name: saved }].sort((a, b) => a.name.localeCompare(b.name, 'fr'))));
      if (multiple) {
        const current = form.getFieldValue(name) || [];
        if (!current.includes(saved)) form.setFieldsValue({ [name]: [...current, saved] });
      } else {
        form.setFieldsValue({ [name]: saved });
      }
      setAdding('');
      message.success('Catégorie ajoutée');
    } catch (err) {
      message.error(apiError(err, "Erreur lors de l'ajout de la catégorie"));
    } finally {
      busy.current = false;
    }
  };

  return (
    <Form.Item name={name} label={multiple ? 'Catégories' : 'Catégorie'}>
      <Select mode={multiple ? 'multiple' : undefined} allowClear showSearch optionFilterProp="label"
        placeholder={multiple ? 'Aucune catégorie' : 'Aucune catégorie'}
        options={options.map((c) => ({ value: c.name, label: c.name }))}
        popupRender={(menu) => (
          <>
            {menu}
            <div className="d-flex gap-2 p-2 border-top">
              <Input value={adding} maxLength={150} placeholder="Nouvelle catégorie"
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => setAdding(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onPressEnter={(e) => { e.preventDefault(); add(); }} />
              <Button type="link" htmlType="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); add(); }}>Ajouter</Button>
            </div>
          </>
        )} />
    </Form.Item>
  );
}
