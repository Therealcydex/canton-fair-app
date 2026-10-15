import { Field, inputClass } from 'sourcing-mobile-ui';

export const TextInput = () => (
  <div className="w-full">
    <Field label="Nom du produit">
      <input className={inputClass} defaultValue="Lampe LED solaire 20 W" />
    </Field>
  </div>
);

export const WithHint = () => (
  <div className="w-full">
    <Field label="Photos (2)" hint="JPEG, PNG ou WebP, 5 Mo au plus chacune">
      <input type="file" className="block w-full text-sm" />
    </Field>
  </div>
);

export const Select = () => (
  <div className="w-full">
    <Field label="Expédition">
      <select className={inputClass} defaultValue="FOB">
        <option value="FOB">FOB — Free On Board</option>
        <option value="EXW">EXW — Ex Works</option>
        <option value="CIF">CIF — Cost, Insurance and Freight</option>
      </select>
    </Field>
  </div>
);

export const FormGrid = () => (
  <div className="grid w-full grid-cols-2 gap-3">
    <Field label="Prix">
      <input className={inputClass} inputMode="decimal" placeholder="12,50" defaultValue="3,80" />
    </Field>
    <Field label="Unité">
      <input className={inputClass} placeholder="pièce" />
    </Field>
    <Field label="MOQ">
      <input className={inputClass} inputMode="numeric" defaultValue="500" />
    </Field>
    <Field label="Description">
      <textarea className={inputClass} rows={2} defaultValue="Boîtier aluminium, IP65" />
    </Field>
  </div>
);
