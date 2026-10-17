import { useEffect, useState } from 'react';

// D60: the search boxes filter as the user types, once the typing pauses (no Enter needed on a
// phone keyboard). An emptied box applies at once.
export default function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (!value) {
      setDebounced(value);
      return undefined;
    }
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
