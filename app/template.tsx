'use client';

import { useEffect } from 'react';

export default function Template({ children }: { children: React.ReactNode }) {
  // Marks the document as script-capable so reveal styles may hide content
  // before it animates in; without JavaScript everything stays visible.
  useEffect(() => {
    document.documentElement.classList.add('js');
  }, []);

  return <div className="page-transition">{children}</div>;
}
