// Scroll restoration via history.state + popstate event.
// When navigating from a workout page to exercise-detail, we save scrollY
// into the workout page's history entry via replaceState. When the user presses
// back, popstate fires and delivers that Y value — no sessionStorage, no races.

let capturedY: number | null = null;

window.addEventListener('popstate', (e) => {
  capturedY = (typeof e.state?.srY === 'number') ? e.state.srY : null;
});

/** Call before navigating away to save current scroll into this history entry. */
export function saveScrollRestore(_path: string, y: number) {
  try {
    history.replaceState({ ...history.state, srY: y }, '');
  } catch {
    // ignore
  }
}

/** Call in a workout page's useLayoutEffect. Returns saved Y if arriving via back nav, else null. */
export function consumeScrollRestore(_path: string): number | null {
  const y = capturedY;
  capturedY = null;
  return y;
}

/** No-op — kept for compatibility. */
export function clearScrollRestore() {}
