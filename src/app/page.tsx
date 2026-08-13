"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteGalleryTag,
  deleteTag,
  getGalleryTagTree,
  getTagTree,
  renameGalleryTag,
  renameTag,
} from "@/lib/api";
import { getConfig } from "@/lib/config";
import { useServerConfig } from "@/lib/useServerConfig";
import { useResizableWidth } from "@/lib/useResizableWidth";
import { flattenTagPaths } from "@/lib/tags";
import type { Photo, TagNode } from "@/lib/types";
import TagSearch from "@/components/TagSearch";
import TagExplorer from "@/components/TagExplorer";
import PhotoGrid, { type PhotoGridHandle } from "@/components/PhotoGrid";
import ResizeHandle from "@/components/ResizeHandle";
import UploadDropzone from "@/components/UploadDropzone";
import ImportFromPathPanel from "@/components/ImportFromPathPanel";
import DownloaderPanel from "@/components/DownloaderPanel";
import SettingsPanel from "@/components/SettingsPanel";
import GalleriesPanel from "@/components/GalleriesPanel";

type Tab = "library" | "galleries" | "explorer" | "upload" | "trash" | "settings";

const TAB_LABELS: Record<Tab, string> = {
  library: "Library",
  galleries: "Galleries",
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
  const [galleryTree, setGalleryTree] = useState<TagNode[]>([]);
  // null = no search submitted yet (grid stays empty); "" = searched with no
  // filter (show everything); anything else = the submitted boolean query.
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [gallerySelectedTag, setGallerySelectedTag] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [removingSelectedTag, setRemovingSelectedTag] = useState<string | null>(null);
  const photoGridRef = useRef<PhotoGridHandle>(null);
  const config = useServerConfig();
  const [tab, setTab] = useState<Tab>("library");
  const [uploadMode, setUploadMode] = useState<"files" | "path" | "downloader">("files");
  const sidebar = useResizableWidth({ initial: 432, min: 180, max: 960, panelSide: "right" });

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
    getGalleryTagTree()
      .then(setGalleryTree)
      .catch(() => {});
  }, [config]);

  const tagSuggestions = useMemo(() => flattenTagPaths(tree), [tree]);
  const galleryTagSuggestions = useMemo(() => flattenTagPaths(galleryTree), [galleryTree]);

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

  async function handleRemoveSelectedTag(tag: string) {
    setRemovingSelectedTag(tag);
    try {
      await photoGridRef.current?.removeTagFromSelected(tag);
    } finally {
      setRemovingSelectedTag(null);
    }
  }

  // Reset the displayed count during render (not an effect) when the search
  // query changes, so the previous query's stale count doesn't flash while
  // the grid reloads. See https://react.dev/learn/you-might-not-need-an-effect
  const [countedSelection, setCountedSelection] = useState(searchQuery);
  if (searchQuery !== countedSelection) {
    setCountedSelection(searchQuery);
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
            <main className="flex-1 flex flex-col min-h-0 p-4">
              <h1 className="text-lg font-semibold mb-4 shrink-0">
                {searchQuery === null ? "No search yet" : searchQuery || "All photos"}{" "}
                <span className="text-sm font-normal text-neutral-500">
                  ({photoCount} {photoCount === 1 ? "photo" : "photos"})
                </span>
              </h1>
              <PhotoGrid
                ref={photoGridRef}
                key={searchQuery ?? "__none__"}
                query={searchQuery}
                tagSuggestions={tagSuggestions}
                onCountChange={setPhotoCount}
                onSelectionChange={setSelectedPhotos}
              />
            </main>
            <ResizeHandle
              onPointerDown={sidebar.onPointerDown}
              onPointerMove={sidebar.onPointerMove}
              onPointerUp={sidebar.onPointerUp}
            />
            <aside
              style={{ width: sidebar.width }}
              className="shrink-0 border-l border-neutral-200 dark:border-neutral-800 p-3 overflow-y-auto"
            >
              {selectedPhotos.length > 0 ? (
                <>
                  <h2 className="text-xs font-semibold uppercase text-neutral-500 mb-2">
                    Selected tags
                  </h2>
                  {selectedTagCounts.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {selectedTagCounts.map(([t, count]) => (
                        <li key={t} className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedTag(t)}
                            disabled={removingSelectedTag === t}
                            title={`Remove "${t}" from selected photos`}
                            className="truncate text-left hover:text-red-600 hover:line-through cursor-pointer disabled:opacity-50"
                          >
                            {t}
                          </button>
                          <span className="text-neutral-500 shrink-0">{count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-neutral-500">No tags</p>
                  )}
                </>
              ) : (
                <TagSearch
                  tagSuggestions={tagSuggestions}
                  query={searchQuery}
                  onSearch={setSearchQuery}
                  onClear={() => setSearchQuery(null)}
                />
              )}
            </aside>
          </div>
        ) : (
          <NotConfiguredNotice onGoToSettings={() => setTab("settings")} />
        ))}

      {tab === "galleries" &&
        (config ? (
          <div className="flex-1 min-h-0 flex flex-col p-4">
            <GalleriesPanel
              tag={gallerySelectedTag}
              onClearTag={() => setGallerySelectedTag(null)}
              photoTagSuggestions={tagSuggestions}
              galleryTagSuggestions={galleryTagSuggestions}
            />
          </div>
        ) : (
          <NotConfiguredNotice onGoToSettings={() => setTab("settings")} />
        ))}

      {tab === "explorer" &&
        (config ? (
          <div className="flex-1 p-4 max-w-4xl mx-auto w-full overflow-y-auto flex flex-col sm:flex-row gap-8">
            <div className="flex-1 min-w-0">
              <h2 className="text-xs font-semibold uppercase text-neutral-500 mb-2">Photo tags</h2>
              <TagExplorer
                tree={tree}
                onRenamed={setTree}
                onRename={renameTag}
                onDelete={deleteTag}
                onSelectTag={(path) => {
                  setSearchQuery(path);
                  setTab("library");
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xs font-semibold uppercase text-neutral-500 mb-2">Gallery tags</h2>
              <TagExplorer
                tree={galleryTree}
                onRenamed={setGalleryTree}
                onRename={renameGalleryTag}
                onDelete={deleteGalleryTag}
                onSelectTag={(path) => {
                  setGallerySelectedTag(path);
                  setTab("galleries");
                }}
              />
            </div>
          </div>
        ) : (
          <NotConfiguredNotice onGoToSettings={() => setTab("settings")} />
        ))}

      {tab === "upload" &&
        (config ? (
          <div className="flex-1 p-4 max-w-2xl mx-auto w-full overflow-y-auto">
            <div className="flex gap-1 mb-4 border border-neutral-300 dark:border-neutral-700 rounded w-fit">
              {(
                [
                  ["files", "Upload files"],
                  ["path", "Import from server path"],
                  ["downloader", "Download from URL"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setUploadMode(mode)}
                  className={`px-3 py-1.5 text-sm rounded ${
                    uploadMode === mode
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {uploadMode === "files" && <UploadDropzone tagSuggestions={tagSuggestions} />}
            {uploadMode === "path" && <ImportFromPathPanel tagSuggestions={tagSuggestions} />}
            {uploadMode === "downloader" && <DownloaderPanel />}
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
