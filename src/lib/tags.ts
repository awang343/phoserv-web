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
