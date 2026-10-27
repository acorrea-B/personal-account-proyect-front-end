'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// The Account menu: the dashboard actions (Update profile, Sign out) in
// one dropdown, closed by an outside click or Escape. Shared by the
// workspace dashboard and the update-profile flow, which is part of the
// dashboard's flow — never part of the onboarding card.
export function AccountMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onDocumentMouseDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="button button-ghost"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        Account
      </button>
      {menuOpen ? (
        <ul className="account-menu-list" role="menu" aria-label="Account actions">
          <li role="none">
            <Link role="menuitem" className="account-menu-item" href="/app/profile/">
              Update profile
            </Link>
          </li>
          <li role="none">
            <button
              role="menuitem"
              type="button"
              className="account-menu-item"
              onClick={() => {
                setMenuOpen(false);
                // Navigate, do NOT mutate the session in place: the mounted
                // page keeps its in-memory session and would look signed in
                // after a storage-only clear. The /logout/ route owns the
                // revoke + clear + redirect flow.
                router.replace('/logout/');
              }}
            >
              Sign out
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
