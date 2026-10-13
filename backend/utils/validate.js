// Validates a request body against a field list, always on the server and unconditionally:
// a missing field is checked like a present one. On update, `existing` supplies the values
// the client did not send, so a partial body cannot skip a rule.
//
// Field spec: { label, type: 'string'|'text'|'email'|'int'|'decimal'|'bool'|'enum',
//               required, max (length), min/maxValue (numbers), values (enum), scale (decimal) }
// Returns { values } or { message } (a French message for a 400).
const { EMAIL_RE } = require('./http');

function readField(key, spec, raw) {
  const { label } = spec;
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    if (spec.required) return { error: `${label} : champ obligatoire` };
    return { value: spec.type === 'bool' ? 0 : null };
  }

  switch (spec.type) {
    case 'bool':
      return { value: raw === true || raw === 1 || raw === '1' || raw === 'true' ? 1 : 0 };
    case 'int': {
      const n = Number(raw);
      if (!Number.isInteger(n)) return { error: `${label} : nombre entier attendu` };
      if (spec.min !== undefined && n < spec.min) return { error: `${label} : minimum ${spec.min}` };
      if (spec.maxValue !== undefined && n > spec.maxValue) return { error: `${label} : maximum ${spec.maxValue}` };
      return { value: n };
    }
    case 'decimal': {
      // Kept as a string: DECIMAL values never go through a JavaScript float.
      const s = String(raw).trim().replace(',', '.');
      const scale = spec.scale ?? 3;
      const re = new RegExp(`^\\d{1,${(spec.precision ?? 12) - scale}}(\\.\\d{1,${scale}})?$`);
      if (!re.test(s)) return { error: `${label} : montant invalide (au plus ${scale} décimales, positif)` };
      return { value: s };
    }
    case 'enum': {
      const s = String(raw).trim();
      if (!spec.values.includes(s)) return { error: `${label} : valeur non autorisée` };
      return { value: s };
    }
    default: {
      const s = String(raw).trim();
      if (spec.max && s.length > spec.max) return { error: `${label} : ${spec.max} caractères au maximum` };
      if (spec.type === 'email' && !EMAIL_RE.test(s)) return { error: `${label} : adresse e-mail invalide` };
      return { value: spec.upper ? s.toUpperCase() : s };
    }
  }
}

function validate(body, fields, existing) {
  const b = body || {};
  const values = {};
  for (const [key, spec] of Object.entries(fields)) {
    const raw = b[key] !== undefined ? b[key] : existing?.[key];
    const r = readField(key, spec, raw);
    if (r.error) return { message: r.error };
    values[key] = r.value;
  }
  return { values };
}

module.exports = { validate };
