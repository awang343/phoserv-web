"use client";

import { useMemo, useState } from "react";
import type { TagNode } from "@/lib/types";
import { flattenTagPaths } from "@/lib/tags";

const MIN_QUERY_LENGTH = 3;

export default function TagSearch({
  tree,
  selected,
  onSelect,
}: {
  tree: TagNode[];
  selected: string | null;
  onSelect: (path: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const allPaths = useMemo(() => flattenTagPaths(tree), [tree]);
  const matches = useMemo(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return [];
    const q = trimmed.toLowerCase();
    return allPaths.filter((path) => path.toLowerCase().includes(q));
  }, [allPaths, trimmed]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tags..."
        className="w-full border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-transparent mb-2"
      />
      {selected && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="w-full text-left px-2 py-1 rounded text-xs text-blue-600 hover:bg-neutral-200 dark:hover:bg-neutral-800 mb-1"
        >
          Clear filter ({selected})
        </button>
      )}
      {trimmed.length < MIN_QUERY_LENGTH ? (
        <p className="text-sm text-neutral-500 px-2">
          Type at least {MIN_QUERY_LENGTH} characters to search tags
        </p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-neutral-500 px-2">No matching tags</p>
      ) : (
        <ul className="space-y-0.5">
          {matches.map((path) => {
            const isSelected = selected === path;
            return (
              <li key={path}>
                <button
                  type="button"
                  onClick={() => onSelect(isSelected ? null : path)}
                  className={`w-full text-left px-2 py-1 rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800 ${
                    isSelected ? "bg-neutral-200 dark:bg-neutral-800 font-medium" : ""
                  }`}
                >
                  {path}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
