// Display helpers shared by the booth, visit and product screens.

export const VISIT_STATUS = {
  prevu: { label: 'Prévu', color: 'blue' },
  visite: { label: 'Visité', color: 'green' },
  annule: { label: 'Annulé', color: 'default' },
};

// "2026-10-16 10:30:00" (as stored: the time at the fair) -> "16/10/2026 10:30".
export const formatDateTime = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s || '');
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '—';
};

// Stored value -> value of an <input type="datetime-local"> ("2026-10-16T10:30").
export const toInputDateTime = (s) => {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(s || '');
  return m ? `${m[1]}T${m[2]}` : '';
};

// Builds the tree used by TreeSelect / Tree from the flat category list.
export const categoryTree = (flat) => {
  const nodes = new Map(flat.map((c) => [c.id, { value: c.id, key: c.id, title: c.name, depth: c.depth, children: [] }]));
  const roots = [];
  for (const c of flat) {
    const node = nodes.get(c.id);
    if (c.parent_id && nodes.has(c.parent_id)) nodes.get(c.parent_id).children.push(node);
    else roots.push(node);
  }
  const sort = (list) => {
    list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    list.forEach((n) => {
      if (n.children.length) sort(n.children);
      else delete n.children;
    });
    return list;
  };
  return sort(roots);
};
