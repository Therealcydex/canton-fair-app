// Tailwind build of the kit's styles.css: the mobile app's own classes plus the palette and
// utilities a design is likely to need, so a design written in the same idiom stays styled.
const colors = 'slate|blue|red|green|orange|amber';
const shades = '50|100|200|300|400|500|600|700|800|900';
module.exports = {
  content: ['../../mobile/src/**/*.{ts,tsx}', './.design-sync/previews/**/*.tsx'],
  safelist: [
    { pattern: new RegExp(`^(bg|text|border)-(${colors})-(${shades})$`), variants: ['active', 'disabled', 'focus'] },
    { pattern: /^(bg|text|border)-(white|black|transparent)$/ },
    { pattern: /^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-y|space-x)-(0|0\.5|1|1\.5|2|2\.5|3|4|5|6|8|10|12|16|24)$/ },
    { pattern: /^text-(xs|sm|base|lg|xl|2xl|3xl)$/ },
    { pattern: /^font-(normal|medium|semibold|bold)$/ },
    { pattern: /^rounded(-(none|sm|md|lg|xl|2xl|full))?$/ },
    { pattern: /^shadow(-(sm|md|lg|none))?$/ },
    { pattern: /^grid-cols-(1|2|3|4)$/ },
    { pattern: /^(flex|grid|block|inline-block|hidden|flex-1|flex-col|flex-wrap|items-center|items-start|justify-between|justify-center|text-center|truncate|w-full|border|border-t|border-b|divide-y)$/ },
  ],
  theme: { extend: {} },
  plugins: [],
};
