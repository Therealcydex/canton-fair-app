import { useEffect, useRef, useState } from 'react';
import { Alert, Form, Modal } from 'antd';
import { apiError } from '../utils/apiError';

// A modal form that saves through `onSubmit(values)`. On a refusal it stays open and shows
// the server's message; on success it closes and calls `onSaved`.
// `initialValues` is applied each time the modal opens.
export default function FormModal({ open, title, initialValues, onSubmit, onSaved, onCancel, children, width }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Read when the modal opens only: a parent re-render must not wipe what the user typed.
  const initial = useRef(initialValues);
  initial.current = initialValues;

  useEffect(() => {
    if (open) {
      setError(null);
      form.resetFields();
      form.setFieldsValue(initial.current || {});
    }
  }, [open, form]);

  const submit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // field errors are shown by the form
    }
    setSaving(true);
    setError(null);
    try {
      const result = await onSubmit(values);
      onSaved?.(result);
    } catch (err) {
      setError(apiError(err, "Erreur lors de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={title} onCancel={onCancel} onOk={submit} okText="Enregistrer"
      cancelText="Annuler" confirmLoading={saving} width={width} forceRender>
      {error && <Alert type="error" message={error} showIcon className="mb-3" />}
      <Form form={form} layout="vertical" requiredMark={false}>
        {children}
      </Form>
    </Modal>
  );
}
