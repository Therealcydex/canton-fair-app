import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// D68: Retour brings the user back to the same list — the scroll, and (with useStickyState)
// the filters, the search and the page. The scroll of the page being left is kept on the
// click, before the next page moves the window.

const scrollKey = (path) => `scroll:${path}`;

export function useScrollPlace() {
  const { pathname, search } = useLocation();
  const path = pathname + search;
  const pathRef = useRef(path);
  const yRef = useRef(typeof window === 'undefined' ? 0 : window.scrollY);
  const lock = useRef(false);

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const onScroll = () => {
      if (lock.current) return;
      yRef.current = window.scrollY;
      sessionStorage.setItem(scrollKey(pathRef.current), String(window.scrollY));
    };
    // A link is followed after this capture, so the spot is saved before the window jumps.
    const onClick = (e) => {
      if (!e.target.closest('a')) return;
      yRef.current = window.scrollY;
      sessionStorage.setItem(scrollKey(pathRef.current), String(window.scrollY));
      lock.current = true;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  useLayoutEffect(() => {
    lock.current = true;
    const prev = pathRef.current;
    if (prev !== path) {
      sessionStorage.setItem(scrollKey(prev), String(yRef.current));
      pathRef.current = path;
    }
    const y = Number(sessionStorage.getItem(scrollKey(path)) || 0);
    yRef.current = y;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      window.scrollTo(0, y);
      const room = document.documentElement.scrollHeight - window.innerHeight;
      const waiting = y > 0 && room + 2 < y;
      if ((waiting || Math.abs(window.scrollY - y) > 2) && performance.now() - start < 1500) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    const unlock = setTimeout(() => { lock.current = false; }, 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(unlock);
    };
  }, [path]);
}

// A piece of list state (filters, search, page) kept for the tab, so Retour finds it again.
export function useStickyState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw == null) return initial;
      return JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

// A new filter starts back at page 1. The first render keeps the page Retour restored.
export function useResetPage(signature, setPage) {
  const seen = useRef(signature);
  useEffect(() => {
    if (seen.current === signature) return;
    seen.current = signature;
    setPage(1);
  }, [signature, setPage]);
}
