// The web app's global CSS, in the order of frontend/src/index.js: Bootstrap, then index.css.
// Ant Design 5 injects its own styles at runtime.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..', 'frontend');
const parts = [
  path.join(root, 'node_modules', 'bootstrap', 'dist', 'css', 'bootstrap.min.css'),
  path.join(root, 'src', 'index.css'),
];

// Claude Design's token check needs to know what each theme variable is: the literal colours and
// the --bs-*-rgb triplets ("13,110,253") are colours, the other theme variables (sizes, fonts,
// icons, filters, inherit) are "other". Only the theme blocks are touched; the
// variables set under component selectors (.btn, .table-striped, a:hover...) are Bootstrap's
// local overrides, not tokens, and stay as they are.
const THEME = /^(\s*(:root|\[data-bs-theme=\w+\])\s*,?)+$/;
const LITERAL_COLOR = /^\s*(#|rgba?\(|hsla?\(|color-mix\()/;
// Splits a rule body on the semicolons that are outside brackets and quotes (url("data:..."), var()).
const splitDecls = (body) => {
  const out = [];
  let depth = 0; let quote = null; let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (quote) { if (c === quote && body[i - 1] !== '\\') quote = null; } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    else if (c === ';' && depth === 0) { out.push(body.slice(start, i)); start = i + 1; }
  }
  out.push(body.slice(start));
  return out;
};
const classify = (css) => css.replace(/([^{};]+)\{([^{}]*)\}/g, (rule, selector, body) => {
  if (!THEME.test(selector.replace(/\/\*[\s\S]*?\*\//g, ''))) return rule;
  const decls = splitDecls(body).map((decl) => {
    const m = /^\s*(--[\w-]+)\s*:([\s\S]*)$/.exec(decl);
    if (!m) return decl;
    return `${decl}/* @kind ${/-rgb$/.test(m[1]) || LITERAL_COLOR.test(m[2]) ? 'color' : 'other'} */`;
  });
  return `${selector}{${decls.join(';')}}`;
});

fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
const css = parts.map((p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\/\*# sourceMappingURL=.*?\*\//g, '')).join('\n');
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'styles.css'), classify(css));
