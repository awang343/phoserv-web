"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTagTree } from "@/lib/api";
import type { TagNode } from "@/lib/types";
import TagTree from "@/components/TagTree";
import PhotoGrid from "@/components/PhotoGrid";

export default function HomePage() {
  const [tree, setTree] = useState<TagNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    getTagTree()
      .then(setTree)
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="w-56 shrink-0 border-r border-neutral-200 dark:border-neutral-800 p-3 overflow-y-auto">
        <h2 className="text-xs font-semibold uppercase text-neutral-500 mb-2">Tags</h2>
        <TagTree nodes={tree} selected={selected} onSelect={setSelected} />
      </aside>
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">{selected ?? "All photos"}</h1>
          <Link href="/upload" className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white">
            Upload
          </Link>
        </div>
        <PhotoGrid tag={selected} />
      </main>
    </div>
  );
}
