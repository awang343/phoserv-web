"use client";

import { useMemo, useState } from "react";
import type { TagNode } from "@/lib/types";
import { filterTagTree } from "@/lib/tags";

function countDescendants(node: TagNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

function TagExplorerNode({
  node,
  onRenamed,
  onSelectTag,
  onRename,
  onDelete,
  forceExpand,
}: {
  node: TagNode;
  onRenamed: (tree: TagNode[]) => void;
  onSelectTag: (path: string) => void;
  onRename: (id: number, name: string) => Promise<TagNode[]>;
  onDelete: (id: number) => Promise<TagNode[]>;
  forceExpand: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(node.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  // While actively filtering, matched subtrees stay open regardless of the
  // manual toggle below — otherwise search results would hide behind a
  // collapsed ancestor. The toggle still tracks its own state so the tree
  // reverts to the user's manual choices once the filter is cleared.
  const isExpanded = expanded || forceExpand;

  function cancel() {
    setEditing(false);
    setValue(node.name);
    setError(null);
  }

  async function save() {
    const name = value.trim();
    if (!name || name === node.name) {
      cancel();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tree = await onRename(node.id, name);
      onRenamed(tree);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename tag");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const tree = await onDelete(node.id);
      onRenamed(tree);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete tag");
      setDeleting(false);
    }
  }

  return (
    <li>
      <div className="flex items-center gap-2 px-2 py-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            className="text-xs text-neutral-500 hover:text-blue-600 w-3 shrink-0 cursor-pointer"
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {editing ? (
          <>
            <input
              type="text"
              value={value}
              autoFocus
              disabled={saving}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
              className="border border-neutral-300 dark:border-neutral-700 rounded px-1 py-0.5 text-sm bg-transparent"
            />
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="text-xs text-blue-600 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="text-xs text-neutral-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : confirmingDelete ? (
          <>
            <span className="text-sm">{node.name}</span>
            <span className="text-xs text-neutral-500">
              Delete{countDescendants(node) > 0 ? ` (and ${countDescendants(node)} sub-tag${countDescendants(node) === 1 ? "" : "s"})` : ""} everywhere?
            </span>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="text-xs text-red-600 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="text-xs text-neutral-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSelectTag(node.path)}
              className="text-sm text-left hover:text-blue-600 hover:underline cursor-pointer"
            >
              {node.name} <span className="text-neutral-500">({node.count})</span>
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-neutral-500 hover:text-blue-600"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="text-xs text-neutral-500 hover:text-red-600"
            >
              Delete
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-600 px-2">{error}</p>}
      {hasChildren && isExpanded && (
        <ul className="pl-4 border-l border-neutral-200 dark:border-neutral-800 ml-2">
          {node.children.map((child) => (
            <TagExplorerNode
              key={child.id}
              node={child}
              onRenamed={onRenamed}
              onSelectTag={onSelectTag}
              onRename={onRename}
              onDelete={onDelete}
              forceExpand={forceExpand}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TagExplorer({
  tree,
  onRenamed,
  onSelectTag,
  onRename,
  onDelete,
}: {
  tree: TagNode[];
  onRenamed: (tree: TagNode[]) => void;
  onSelectTag: (path: string) => void;
  onRename: (id: number, name: string) => Promise<TagNode[]>;
  onDelete: (id: number) => Promise<TagNode[]>;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterTagTree(tree, query), [tree, query]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter tags..."
        className="w-full border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-transparent mb-3"
      />
      {tree.length === 0 ? (
        <p className="text-sm text-neutral-500 px-2">No tags yet</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-neutral-500 px-2">No matching tags</p>
      ) : (
        <ul className="space-y-0.5">
          {filtered.map((node) => (
            <TagExplorerNode
              key={node.id}
              node={node}
              onRenamed={onRenamed}
              onSelectTag={onSelectTag}
              onRename={onRename}
              onDelete={onDelete}
              forceExpand={query.trim() !== ""}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
