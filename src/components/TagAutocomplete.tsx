"use client";

import { useState, type KeyboardEvent } from "react";

const MAX_SUGGESTIONS = 20;

/**
 * A plain text input with a substring-matching suggestion dropdown, used
 * when adding a single tag term (e.g. a block in the search query builder).
 * `onSubmit` fires both when a suggestion is picked and when Enter is
 * pressed with no suggestion highlighted, so freeform (not-yet-existing)
 * tag paths still work.
 */
export default function TagAutocomplete({
  value,
  onChange,
  onSubmit,
  suggestions,
  placeholder,
  className = "",
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const trimmed = value.trim().toLowerCase();
  const filtered = trimmed
    ? suggestions.filter((s) => s.toLowerCase().includes(trimmed)).slice(0, MAX_SUGGESTIONS)
    : [];

  function choose(v: string) {
    onSubmit(v);
    setOpen(false);
    setHighlight(0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length > 0) {
        setOpen(true);
        setHighlight((h) => (h + 1) % filtered.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length > 0) {
        setOpen(true);
        setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered.length > 0 && highlight < filtered.length) {
        choose(filtered[highlight]);
      } else if (value.trim()) {
        choose(value.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delayed so a suggestion's onClick still registers before the
          // dropdown unmounts (blur fires first otherwise).
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-transparent"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg text-sm">
          {filtered.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-2 py-1 cursor-pointer ${
                  i === highlight ? "bg-neutral-200 dark:bg-neutral-800" : ""
                }`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
