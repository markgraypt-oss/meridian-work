import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'wouter';

let navigatingBack = false;

export function useScrollRestoration() {
  const [location] = useLocation();
  const mounted = useRef(false);

  useEffect(() => {
    const onPopState = () => { navigatingBack = true; };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Before paint: scroll to top on forward navigation.
  // On back navigation, skip so the workout page can restore position.
  useLayoutEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (navigatingBack) { navigatingBack = false; return; }
    window.scrollTo(0, 0);
  }, [location]);
}
