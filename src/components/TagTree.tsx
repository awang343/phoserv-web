"use client";

import type { TagNode } from "@/lib/types";

function TagTreeNode({
  node,
  selected,
  onSelect,
}: {
  node: TagNode;
  selected: string | null;
  onSelect: (path: string | null) => void;
}) {
  const isSelected = selected === node.path;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(isSelected ? null : node.path)}
        className={`w-full text-left px-2 py-1 rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800 ${
          isSelected ? "bg-neutral-200 dark:bg-neutral-800 font-medium" : ""
        }`}
      >
        {node.name}
      </button>
      {node.children.length > 0 && (
        <ul className="pl-4 border-l border-neutral-200 dark:border-neutral-800 ml-2">
          {node.children.map((child) => (
            <TagTreeNode key={child.id} node={child} selected={selected} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TagTree({
  nodes,
  selected,
  onSelect,
}: {
  nodes: TagNode[];
  selected: string | null;
  onSelect: (path: string | null) => void;
}) {
  if (nodes.length === 0) {
    return <p className="text-sm text-neutral-500 px-2">No tags yet</p>;
  }
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <TagTreeNode key={node.id} node={node} selected={selected} onSelect={onSelect} />
      ))}
    </ul>
  );
}
