'use client';

import { type InputHTMLAttributes, useEffect, useRef, useState } from 'react';

import { Spinner, cx, inputClass } from '@/components/ui';
import { searchSkillCatalog } from '@/lib/api/suggestions';
import { type Locale, labels } from '@/lib/i18n';
import type { SkillCatalogEntry } from '@/lib/schemas/suggestions';

// The name being typed: what follows the last comma, trimmed.
export function lastSkillToken(value: string): string {
  return value.slice(value.lastIndexOf(',') + 1).trim();
}

const minPrefix = 2;
const debounceMs = 250;

// The skills field with the shared catalog's autocomplete (BC-012): while
// the user types the last comma-separated name, the de-identified catalog
// offers the spellings other people confirmed; picking one replaces the
// typed name. Names already in the list are not offered again. It follows
// the combobox pattern of the location field (arrows, Enter, Escape).
export function SkillCatalogInput({
  value,
  onValueChange,
  accessToken,
  locale,
  ...input
}: {
  value: string;
  onValueChange: (value: string) => void;
  accessToken: string;
  locale: Locale;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const t = labels(locale).catalogInput;
  const listId = `${input.id ?? 'skills'}-catalog`;
  const [options, setOptions] = useState<SkillCatalogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [searching, setSearching] = useState(false);
  const request = useRef(0);

  const token = lastSkillToken(value);

  useEffect(() => {
    // Every run invalidates the search in flight, the short-token path
    // included: a late answer for an older token never repopulates the list.
    const id = ++request.current;
    // The list always belongs to the token on screen: the old matches and
    // their highlight leave as soon as the token changes, so Enter during
    // the debounce never inserts a match for a name no longer typed.
    setOptions([]);
    setHighlight(-1);
    if (token.length < minPrefix) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchSkillCatalog(accessToken, token)
        .then((entries) => {
          if (id !== request.current) {
            return;
          }
          const typed = new Set(
            value
              .split(',')
              .slice(0, -1)
              .map((name) => name.trim().toLowerCase())
              .filter(Boolean),
          );
          setOptions(entries.filter((entry) => !typed.has(entry.display_name.toLowerCase())));
          setHighlight(-1);
        })
        .catch(() => {
          // An acceleration, never a gate: a failed search offers nothing.
          if (id === request.current) {
            setOptions([]);
          }
        })
        .finally(() => {
          if (id === request.current) {
            setSearching(false);
          }
        });
    }, debounceMs);
    return () => window.clearTimeout(timer);
    // The value only matters through the token and the names before it.
  }, [token, value, accessToken]);

  function pick(index: number) {
    const entry = options[index];
    if (!entry) {
      return;
    }
    const head = value.slice(0, value.lastIndexOf(',') + 1);
    const prefix = head ? `${head.trimEnd()} ` : '';
    onValueChange(`${prefix}${entry.display_name}, `);
    setOptions([]);
    setOpen(false);
    setHighlight(-1);
  }

  const expanded = open && options.length > 0;

  return (
    <div className="relative grid">
      <input
        {...input}
        className={cx(inputClass, 'pr-[34px]')}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={expanded}
        aria-busy={searching}
        aria-activedescendant={expanded && highlight >= 0 ? `${listId}-${highlight}` : undefined}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!expanded) {
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((previous) => (previous + 1) % options.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((previous) => (previous <= 0 ? options.length - 1 : previous - 1));
          } else if (event.key === 'Enter' && highlight >= 0) {
            event.preventDefault();
            pick(highlight);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {searching ? <Spinner className="absolute top-1/2 right-[10px] -mt-[7px]" /> : null}
      {searching ? <span className="sr-only">{t.searching}</span> : null}
      {expanded ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t.listAria}
          className="absolute top-full right-0 left-0 z-10 m-0 list-none rounded-lg border border-stone-border bg-pure-white p-4 shadow-sm"
        >
          {options.map((entry, index) => (
            <li
              key={entry.skill_key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlight}
            >
              <button
                type="button"
                className={cx(
                  'flex min-h-[44px] w-full cursor-pointer items-center rounded-md border-none px-[14px] py-12 text-left [font-family:inherit] text-[15px] [font-weight:inherit] [line-height:inherit] text-ink-black hover:bg-sky-wash',
                  index === highlight ? 'bg-sky-wash' : 'bg-transparent',
                )}
                // mousedown only keeps the focus in the field (the list stays
                // open); the pick runs on click, so keyboard and assistive
                // activation work too.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(index)}
                onMouseEnter={() => setHighlight(index)}
              >
                {entry.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
