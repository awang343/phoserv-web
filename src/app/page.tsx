"use client";

import { useEffect, useMemo, useState } from "react";
import { getTagTree } from "@/lib/api";
import { getConfig } from "@/lib/config";
import { useServerConfig } from "@/lib/useServerConfig";
import { flattenTagPaths } from "@/lib/tags";
import type { Photo, TagNode } from "@/lib/types";
import TagSearch from "@/components/TagSearch";
import TagExplorer from "@/components/TagExplorer";
import PhotoGrid from "@/components/PhotoGrid";
import UploadDropzone from "@/components/UploadDropzone";
import SettingsPanel from "@/components/SettingsPanel";

type Tab = "library" | "explorer" | "upload" | "trash" | "settings";

const TAB_LABELS: Record<Tab, string> = {
  library: "Library",
  explorer: "Tag Explorer",
  upload: "Upload",
  trash: "Trash",
  settings: "Settings",
};

function NotConfiguredNotice({ onGoToSettings }: { onGoToSettings: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-sm text-neutral-500 mb-3">Not connected to a phoserv server yet.</p>
        <button
          type="button"
          onClick={onGoToSettings}
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white"
        >
          Go to Settings
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [tree, setTree] = useState<TagNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const config = useServerConfig();
  const [tab, setTab] = useState<Tab>("library");

  // Runs once on mount, client-side only, reading localStorage directly rather than
  // the hydration-safe synced snapshot — avoids racing React's hydration correction.
  // `config` (from useServerConfig) is always null during this same render pass too
  // (its server snapshot is unconditionally empty), so deriving this redirect from
  // it instead would send already-configured users to Settings as well.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!getConfig()) setTab("settings");
  }, []);

  useEffect(() => {
    if (!config) return;
    getTagTree()
      .then(setTree)
      .catch(() => {});
  }, [config]);

  const tagSuggestions = useMemo(() => flattenTagPaths(tree), [tree]);

  const selectedTagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const photo of selectedPhotos) {
      for (const t of photo.tags) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort(
      ([tagA, countA], [tagB, countB]) => countB - countA || tagA.localeCompare(tagB),
    );
  }, [selectedPhotos]);

  // Reset the displayed count during render (not an effect) when the tag
  // filter changes, so the previous tag's stale count doesn't flash while
  // the grid reloads. See https://react.dev/learn/you-might-not-need-an-effect
  const [countedSelection, setCountedSelection] = useState(selected);
  if (selected !== countedSelection) {
    setCountedSelection(selected);
    setPhotoCount(0);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <nav className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 px-4">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px cursor-pointer ${
              tab === t
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      {tab === "library" &&
        (config ? (
          <div className="flex flex-1 min-h-0">
            <aside className="w-56 shrink-0 border-r border-neutral-200 dark:border-neutral-800 p-3 overflow-y-auto">
              {selectedPhotos.length > 0 ? (
                <>
                  <h2 className="text-xs font-semibold uppercase text-neutral-500 mb-2">
                    Selected tags
                  </h2>
                  {selectedTagCounts.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {selectedTagCounts.map(([t, count]) => (
                        <li key={t} className="flex items-center justify-between gap-2">
                          <span className="truncate" title={t}>
                            {t}
                          </span>
                          <span className="text-neutral-500 shrink-0">{count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-neutral-500">No tags</p>
                  )}
                </>
              ) : (
                <>
                  <h2 className="text-xs font-semibold uppercase text-neutral-500 mb-2">Tags</h2>
                  <TagSearch tree={tree} selected={selected} onSelect={setSelected} />
                </>
              )}
            </aside>
            <main className="flex-1 flex flex-col min-h-0 p-4">
              <h1 className="text-lg font-semibold mb-4 shrink-0">
                {selected ?? "All photos"}{" "}
                <span className="text-sm font-normal text-neutral-500">
                  ({photoCount} {photoCount === 1 ? "photo" : "photos"})
                </span>
              </h1>
              <PhotoGrid
                key={selected ?? "__all__"}
                tag={selected}
                tagSuggestions={tagSuggestions}
                onCountChange={setPhotoCount}
                onSelectionChange={setSelectedPhotos}
              />
            </main>
          </div>
        ) : (
          <NotConfiguredNotice onGoToSettings={() => setTab("settings")} />
        ))}

      {tab === "explorer" &&
        (config ? (
          <div className="flex-1 p-4 max-w-2xl mx-auto w-full overflow-y-auto">
            <TagExplorer
              tree={tree}
              onRenamed={setTree}
              onSelectTag={(path) => {
                setSelected(path);
                setTab("library");
              }}
            />
          </div>
        ) : (
          <NotConfiguredNotice onGoToSettings={() => setTab("settings")} />
        ))}

      {tab === "upload" &&
        (config ? (
          <div className="flex-1 p-4 max-w-2xl mx-auto w-full overflow-y-auto">
            <UploadDropzone tagSuggestions={tagSuggestions} />
          </div>
        ) : (
          <NotConfiguredNotice onGoToSettings={() => setTab("settings")} />
        ))}

      {tab === "trash" &&
        (config ? (
          <div className="flex flex-1 min-h-0 flex-col p-4">
            <h1 className="text-lg font-semibold mb-4 shrink-0">Trash</h1>
            <PhotoGrid trash tagSuggestions={tagSuggestions} />
          </div>
        ) : (
          <NotConfiguredNotice onGoToSettings={() => setTab("settings")} />
        ))}

      {tab === "settings" && (
        <div className="flex-1 p-4 max-w-2xl mx-auto w-full overflow-y-auto">
          <SettingsPanel />
        </div>
      )}
    </div>
  );
}
