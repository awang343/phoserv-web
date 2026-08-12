import type { TagNode } from "./types";

export function flattenTagPaths(nodes: TagNode[]): string[] {
  const paths: string[] = [];
  const walk = (list: TagNode[]) => {
    for (const node of list) {
      paths.push(node.path);
      walk(node.children);
    }
  };
  walk(nodes);
  return paths;
}

/**
 * Prunes a tag tree down to nodes matching the query, keeping ancestors of
 * matches for context. If a node itself matches, its whole subtree is kept.
 */
export function filterTagTree(nodes: TagNode[], query: string): TagNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const result: TagNode[] = [];
  for (const node of nodes) {
    if (node.path.toLowerCase().includes(q)) {
      result.push(node);
      continue;
    }
    const filteredChildren = filterTagTree(node.children, query);
    if (filteredChildren.length > 0) {
      result.push({ ...node, children: filteredChildren });
    }
  }
  return result;
}
