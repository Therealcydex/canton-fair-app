// The web app's global CSS, in the order of frontend/src/index.js: Bootstrap, then index.css.
// Ant Design 5 injects its own styles at runtime.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..', 'frontend');
const parts = [
  path.join(root, 'node_modules', 'bootstrap', 'dist', 'css', 'bootstrap.min.css'),
  path.join(root, 'src', 'index.css'),
];
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
const css = parts.map((p) => fs.readFileSync(p, 'utf8').replace(/\/\*# sourceMappingURL=.*?\*\//g, '')).join('\n');
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'styles.css'), css);
