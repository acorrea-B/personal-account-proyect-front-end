'use client';

import { useEffect } from 'react';

export default function Template({ children }: { children: React.ReactNode }) {
  // Marks the document as script-capable so reveal styles may hide content
  // before it animates in; without JavaScript everything stays visible.
  useEffect(() => {
    document.documentElement.classList.add('js');
    // The browser-side precache registers on production exports only: over
    // the dev server it would pin stale shells while routes recompile live.
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // An acceleration, never a dependency: registration failures
        // degrade to plain network navigation.
      });
    }
  }, []);

  // The page entrance (fades up on the house curve); reduced motion shows
  // the page at once.
  return (
    <div className="animate-page-in opacity-0 motion-reduce:transform-none motion-reduce:animate-none motion-reduce:opacity-100">
      {children}
    </div>
  );
}
