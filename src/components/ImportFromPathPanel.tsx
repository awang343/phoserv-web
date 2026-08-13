"use client";

import { useState } from "react";
import { importFromPath } from "@/lib/api";
import type { ImportFileResult, ImportPathResponse, ImportTagRule } from "@/lib/types";
import TagChipsInput from "./TagChipsInput";

const STATUS_LABEL: Record<ImportFileResult["status"], string> = {
  dry_run: "would import",
  uploaded: "uploaded",
  tagged: "tagged (already existed)",
  skipped: "skipped (no new tags)",
  error: "error",
};

const STATUS_CLASS: Record<ImportFileResult["status"], string> = {
  dry_run: "text-neutral-500",
  uploaded: "text-green-600",
  tagged: "text-blue-600",
  skipped: "text-neutral-500",
  error: "text-red-600",
};

export default function ImportFromPathPanel({ tagSuggestions = [] }: { tagSuggestions?: string[] }) {
  const [path, setPath] = useState("");
  const [recursive, setRecursive] = useState(true);
  const [lowercaseTags, setLowercaseTags] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [rules, setRules] = useState<ImportTagRule[]>([]);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ImportPathResponse | null>(null);

  const addRule = () => setRules((prev) => [...prev, { pattern: "", template: "" }]);
  const updateRule = (index: number, patch: Partial<ImportTagRule>) =>
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const removeRule = (index: number) => setRules((prev) => prev.filter((_, i) => i !== index));

  const run = async (dryRun: boolean) => {
    if (!path.trim()) {
      setError("Enter a path on the server to scan.");
      return;
    }
    setBusy(dryRun ? "preview" : "import");
    setError(null);
    try {
      const res = await importFromPath({
        path: path.trim(),
        recursive,
        tags,
        tagRules: rules.filter((r) => r.pattern.trim() && r.template.trim()),
        lowercaseTags,
        dryRun,
      });
      setResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Import photos/videos from a path already on the phoserv server&apos;s filesystem (e.g. a mounted
        drive or staging directory) instead of uploading them from this browser. Files already on the
        server (by content hash) aren&apos;t re-uploaded — only any new tags get attached.
      </p>

      <div>
        <label htmlFor="import-path" className="block text-sm font-medium mb-1">
          Server path
        </label>
        <input
          id="import-path"
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/mnt/staging/vacation2024"
          className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm font-mono"
        />
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={recursive} onChange={(e) => setRecursive(e.target.checked)} />
          Recurse into subdirectories
        </label>
      </div>

      <div>
        <p className="text-sm font-medium mb-1">Fixed tags (applied to every imported file)</p>
        <TagChipsInput
          tags={tags}
          suggestions={tagSuggestions}
          onAdd={(tag) => setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))}
          onRemove={(tag) => setTags((prev) => prev.filter((t) => t !== tag))}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium">Tag rules (regex matched against each file&apos;s full path)</p>
          <button type="button" onClick={addRule} className="text-sm text-blue-600 hover:underline">
            + Add rule
          </button>
        </div>
        <p className="text-xs text-neutral-500 mb-2">
          A rule that matches contributes a tag built from its template, e.g. pattern{" "}
          <code className="font-mono">{"^.*/(?<album>[^/]+)/[^/]+$"}</code> with template{" "}
          <code className="font-mono">{"album/{album}"}</code>. Templates can also use{" "}
          <code className="font-mono">{"{filename}"}</code>, <code className="font-mono">{"{stem}"}</code>, and{" "}
          <code className="font-mono">{"{parent}"}</code>. Rules that don&apos;t match a given file simply add no
          tag for it.
        </p>
        {rules.length > 0 && (
          <ul className="space-y-2 mb-2">
            {rules.map((rule, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={rule.pattern}
                  onChange={(e) => updateRule(i, { pattern: e.target.value })}
                  placeholder="regex, e.g. ^.*/(?<album>[^/]+)/[^/]+$"
                  className="flex-1 min-w-0 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm font-mono"
                />
                <input
                  type="text"
                  value={rule.template}
                  onChange={(e) => updateRule(i, { template: e.target.value })}
                  placeholder="template, e.g. album/{album}"
                  className="flex-1 min-w-0 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => removeRule(i)}
                  className="text-neutral-500 hover:text-red-600 shrink-0"
                  aria-label="Remove rule"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lowercaseTags} onChange={(e) => setLowercaseTags(e.target.checked)} />
          Lowercase resulting tags
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run(true)}
          className="px-3 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-700 disabled:opacity-50"
        >
          {busy === "preview" ? "Scanning…" : "Preview"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run(false)}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
        >
          {busy === "import" ? "Importing…" : "Import"}
        </button>
      </div>

      {response && (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            scanned {response.summary.scanned} · uploaded {response.summary.uploaded} · tagged{" "}
            {response.summary.tagged} · skipped {response.summary.skipped} · errors {response.summary.errors}
          </p>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded max-h-96 overflow-y-auto">
            {response.results.map((r) => (
              <li key={r.path} className="px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs" title={r.path}>
                    {r.path}
                  </span>
                  <span className={`shrink-0 ${STATUS_CLASS[r.status]}`}>
                    {r.error ?? STATUS_LABEL[r.status]}
                  </span>
                </div>
                {r.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block bg-neutral-200 dark:bg-neutral-800 rounded-full px-2 py-0.5 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
            {response.results.length === 0 && (
              <li className="px-3 py-2 text-sm text-neutral-500">No matching photos/videos found under that path.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
