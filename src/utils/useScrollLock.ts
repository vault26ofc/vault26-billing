import { useEffect } from 'react';

// While a pop-up or the side menu is open, the screen behind it must stay
// still: the mouse wheel, a finger swipe or the arrow keys should move the
// pop-up, never the page underneath. Counted, so if a second pop-up opens on
// top of the first, the page stays locked until the last one closes.
let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const body = document.body;
    if (locks === 0) {
      // Hiding the page scrollbar would shift everything right by its width;
      // pad the page by the same amount so nothing jumps.
      const scrollbar = window.innerWidth - html.clientWidth;
      saved = { overflow: html.style.overflow, paddingRight: body.style.paddingRight };
      html.style.overflow = 'hidden';
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0 && saved) {
        html.style.overflow = saved.overflow;
        body.style.paddingRight = saved.paddingRight;
        saved = null;
      }
    };
  }, [active]);
}
