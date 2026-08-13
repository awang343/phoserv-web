"use client";

import { useRef, useState } from "react";
import TagAutocomplete from "@/components/TagAutocomplete";

type Connector = "AND" | "OR";

type Block = {
  id: string;
  // null only for the first block, which has nothing to connect to.
  connector: Connector | null;
  negated: boolean;
  term: string;
};

function quoteIfNeeded(term: string): string {
  return /[\s()"]/.test(term) ? `"${term.replace(/"/g, "")}"` : term;
}

function blockText(b: Block): string {
  return (b.negated ? "-" : "") + quoteIfNeeded(b.term);
}

// Always serializes to conjunctive normal form (an AND of OR-clauses), e.g.
// [A, OR B, AND C, OR D] -> "(A OR B) AND (C OR D)". A block starts a new
// clause unless it's OR-connected to the previous one, in which case it
// joins that clause.
function serializeBlocks(blocks: Block[]): string {
  const clauses: Block[][] = [];
  for (const b of blocks) {
    if (b.connector === "OR" && clauses.length > 0) {
      clauses[clauses.length - 1].push(b);
    } else {
      clauses.push([b]);
    }
  }
  return clauses
    .map((clause) => {
      const text = clause.map(blockText).join(" OR ");
      return clause.length > 1 ? `(${text})` : text;
    })
    .join(" AND ");
}

// Recognizes a single bare (optionally negated) term — e.g. what the Tag
// Explorer's "select tag" hands us. Anything else (multiple terms, quoting,
// parens) isn't reverse-parsed into blocks; the builder just starts fresh
// and the raw query is still reachable via the text mode.
function parseSimpleSingleTerm(raw: string): { term: string; negated: boolean } | null {
  if (raw === "" || /[\s()"]/.test(raw)) return null;
  const negated = raw.startsWith("-");
  const term = negated ? raw.slice(1) : raw;
  if (term === "" || /^(and|or|not)$/i.test(term)) return null;
  return { term, negated };
}

export default function TagSearch({
  tagSuggestions,
  query,
  onSearch,
  onClear,
}: {
  tagSuggestions: string[];
  query: string | null;
  onSearch: (query: string) => void;
  onClear: () => void;
}) {
  const [mode, setMode] = useState<"builder" | "text">("builder");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [pendingTerm, setPendingTerm] = useState("");
  const [pendingConnector, setPendingConnector] = useState<Connector>("AND");
  const [pendingNegated, setPendingNegated] = useState(false);
  const [textDraft, setTextDraft] = useState(query ?? "");
  const nextIdRef = useRef(0);

  const serialized = serializeBlocks(blocks);

  // Re-derive local state when the submitted query changes for a reason
  // other than this component's own last submission (cleared elsewhere, or
  // a tag picked in the Tag Explorer) — adjusted during render rather than
  // in an effect to avoid an extra cascading render.
  // See https://react.dev/learn/you-might-not-need-an-effect
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    if (query !== serialized) {
      setTextDraft(query ?? "");
      if (query === null || query === "") {
        setBlocks([]);
        setMode("builder");
      } else {
        const single = parseSimpleSingleTerm(query);
        if (single) {
          // Deterministic id (rather than the nextIdRef counter used by
          // addBlock's event handler) since refs can't be touched during
          // render.
          setBlocks([{ id: `single:${query}`, connector: null, negated: single.negated, term: single.term }]);
          setMode("builder");
        } else {
          setMode("text");
        }
      }
    }
  }

  function addBlock(rawTerm: string) {
    const term = rawTerm.trim();
    if (!term) return;
    nextIdRef.current += 1;
    setBlocks((prev) => [
      ...prev,
      {
        id: `b${nextIdRef.current}`,
        connector: prev.length > 0 ? pendingConnector : null,
        negated: pendingNegated,
        term,
      },
    ]);
    setPendingTerm("");
    setPendingNegated(false);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function toggleConnector(id: string) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, connector: b.connector === "OR" ? "AND" : "OR" } : b)),
    );
  }

  function toggleNegated(id: string) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, negated: !b.negated } : b)));
  }

  function handleClear() {
    setBlocks([]);
    setTextDraft("");
    onClear();
  }

  function switchToText() {
    setTextDraft(serialized);
    setMode("text");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase text-neutral-500">Search</h2>
        <button
          type="button"
          onClick={() => (mode === "builder" ? switchToText() : setMode("builder"))}
          className="text-xs text-blue-600 hover:underline cursor-pointer"
        >
          {mode === "builder" ? "Use text query" : "Use block builder"}
        </button>
      </div>

      {mode === "builder" ? (
        <>
          <div className="flex items-center gap-1 mb-2">
            {blocks.length > 0 && (
              <select
                value={pendingConnector}
                onChange={(e) => setPendingConnector(e.target.value as Connector)}
                className="text-xs border border-neutral-300 dark:border-neutral-700 rounded px-1 py-1.5 bg-transparent"
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            )}
            <button
              type="button"
              onClick={() => setPendingNegated((v) => !v)}
              title="Exclude this tag (NOT)"
              className={`text-xs px-1.5 py-1.5 rounded border cursor-pointer ${
                pendingNegated
                  ? "bg-red-600 text-white border-red-600"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-500"
              }`}
            >
              NOT
            </button>
            <TagAutocomplete
              value={pendingTerm}
              onChange={setPendingTerm}
              onSubmit={addBlock}
              suggestions={tagSuggestions}
              placeholder="Add a tag…"
              className="flex-1 min-w-0"
            />
          </div>

          {blocks.length > 0 && (
            <ul className="flex flex-wrap items-center gap-1 mb-2">
              {blocks.map((b, i) => (
                <li key={b.id} className="flex items-center gap-1">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleConnector(b.id)}
                      title="Click to toggle AND/OR"
                      className="text-xs px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 cursor-pointer"
                    >
                      {b.connector}
                    </button>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleNegated(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleNegated(b.id);
                      }
                    }}
                    title="Click to toggle NOT"
                    className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded text-xs cursor-pointer ${
                      b.negated
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {b.negated && <span aria-hidden>NOT</span>}
                    {b.term}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBlock(b.id);
                      }}
                      aria-label={`Remove ${b.term}`}
                      className="cursor-pointer hover:opacity-70 px-0.5"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {serialized && <p className="text-xs font-mono text-neutral-500 px-1 mb-1 break-all">{serialized}</p>}

          <div className="mt-auto flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onSearch(serialized)}
              className="w-full px-2 py-1.5 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 cursor-pointer"
            >
              Search
            </button>
            {query !== null && (
              <button
                type="button"
                onClick={handleClear}
                className="self-start px-1 text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Clear search
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-1 mb-1">
            <input
              type="text"
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSearch(textDraft.trim());
                }
              }}
              list="tag-search-suggestions"
              placeholder="Search… e.g. cats AND -people/alice"
              className="flex-1 min-w-0 border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-transparent"
            />
            <datalist id="tag-search-suggestions">
              {tagSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => onSearch(textDraft.trim())}
              className="px-2 py-1 text-xs rounded bg-neutral-800 text-white hover:bg-neutral-700 cursor-pointer"
            >
              Search
            </button>
          </div>
          {query !== null && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full text-left px-1 py-1 rounded text-xs text-blue-600 hover:bg-neutral-200 dark:hover:bg-neutral-800 mb-1"
            >
              Clear search{query ? ` (${query})` : ""}
            </button>
          )}
        </>
      )}
    </div>
  );
}
