"use client";

import { useState } from "react";

export default function TagChipsInput({
  tags,
  suggestions = [],
  onAdd,
  onRemove,
}: {
  tags: string[];
  suggestions?: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [value, setValue] = useState("");

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
      setValue("");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-neutral-200 dark:bg-neutral-800 rounded-full px-2 py-0.5 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="text-neutral-500 hover:text-red-600"
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          list="tag-suggestions"
          placeholder="e.g. people/alice"
          className="flex-1 border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-transparent"
        />
        <datalist id="tag-suggestions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={commit}
          className="px-3 py-1 text-sm rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
        >
          Add
        </button>
      </div>
    </div>
  );
}
