"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  bulkAddTags,
  bulkDeletePermanently,
  bulkRemoveTags,
  listPhotos,
  thumbnailPath,
  TRASH_TAG,
} from "@/lib/api";
import { useAuthMedia } from "@/lib/useAuthMedia";
import type { Photo } from "@/lib/types";
import PhotoLightbox from "@/components/PhotoLightbox";

const PAGE_SIZE = 30;

// Mirrors the grid-cols-* breakpoints on the row element below — keep in sync
// so each virtualized row holds exactly as many photos as CSS displays per row.
const COLUMN_BREAKPOINTS: [minWidth: number, columns: number][] = [
  [1024, 6], // lg
  [768, 4], // md
  [640, 3], // sm
];
const DEFAULT_COLUMNS = 2;

function useColumnCount(): number {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  useEffect(() => {
    const compute = () => {
      const width = window.innerWidth;
      const match = COLUMN_BREAKPOINTS.find(([minWidth]) => width >= minWidth);
      setColumns(match ? match[1] : DEFAULT_COLUMNS);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return columns;
}

const PhotoThumb = memo(function PhotoThumb({
  photo,
  selected,
  onSelect,
  onOpen,
}: {
  photo: Photo;
  selected: boolean;
  onSelect: (e: MouseEvent<HTMLButtonElement>) => void;
  onOpen: () => void;
}) {
  const src = useAuthMedia(thumbnailPath(photo.id, "sm"));
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={`aspect-square block overflow-hidden p-1.5 ${
        selected ? "bg-blue-500" : "bg-neutral-100 dark:bg-neutral-900"
      }`}
    >
      {src && (
        <div className="relative w-full h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={photo.original_filename} className="w-full h-full object-cover" />
          {photo.media_type === "video" && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-black/60 text-white text-sm">
                ▶
              </span>
            </span>
          )}
          {photo.tags.includes(TRASH_TAG) && (
            <span
              title="In trash"
              className="absolute top-1 left-1 flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white text-xs"
            >
              🗑
            </span>
          )}
        </div>
      )}
    </button>
  );
});

export interface PhotoGridHandle {
  // Removes `tag` from every currently selected photo. Photos in the
  // selection that never had the tag are left untouched — the backend
  // delete is a per-photo no-op when the tag isn't present.
  removeTagFromSelected: (tag: string) => Promise<void>;
}

const PhotoGrid = forwardRef<
  PhotoGridHandle,
  {
    // Boolean tag search query (see TagSearch). `null` means no search has
    // been submitted yet, so the grid stays empty instead of fetching; ""
    // means "search with no filter" (show every photo). Ignored when `trash`
    // is set — the trash view always loads immediately.
    query?: string | null;
    trash?: boolean;
    tagSuggestions?: string[];
    onCountChange?: (count: number) => void;
    onSelectionChange?: (selected: Photo[]) => void;
  }
>(function PhotoGrid(
  { query = null, trash = false, tagSuggestions = [], onCountChange, onSelectionChange },
  ref,
) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkTagInput, setShowBulkTagInput] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState("");
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Anchor for shift-click range selection — the index of the last item
  // clicked without shift, so repeated shift-clicks extend from the same
  // starting point (mirrors Finder/Explorer behavior).
  const anchorIndexRef = useRef<number | null>(null);
  const columns = useColumnCount();

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!trash && query === null) return;
      if (loadingRef.current) return;
      if (!reset && !hasMoreRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const res = await listPhotos({
          q: trash ? undefined : query ?? undefined,
          trash,
          limit: PAGE_SIZE,
          cursor: reset ? undefined : cursorRef.current ?? undefined,
        });
        setPhotos((prev) => (reset ? res.photos : [...prev, ...res.photos]));
        setTotal(res.total);
        cursorRef.current = res.next_cursor;
        hasMoreRef.current = res.next_cursor !== null;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [query, trash],
  );

  useEffect(() => {
    cursorRef.current = null;
    hasMoreRef.current = true;
    setSelectedIds(new Set());
    anchorIndexRef.current = null;
    if (!trash && query === null) {
      setPhotos([]);
      setTotal(0);
      return;
    }
    fetchPage(true);
  }, [fetchPage, trash, query]);

  useEffect(() => {
    onCountChange?.(total);
  }, [total, onCountChange]);

  useEffect(() => {
    onSelectionChange?.(photos.filter((p) => selectedIds.has(p.id)));
  }, [photos, selectedIds, onSelectionChange]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchPage(false);
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage]);

  const handleSelect = useCallback(
    (index: number, id: string, e: MouseEvent<HTMLButtonElement>) => {
      if (e.shiftKey && anchorIndexRef.current !== null) {
        const anchor = anchorIndexRef.current;
        const [lo, hi] = anchor < index ? [anchor, index] : [index, anchor];
        setSelectedIds(new Set(photos.slice(lo, hi + 1).map((p) => p.id)));
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
      } else {
        setSelectedIds((prev) =>
          prev.size === 1 && prev.has(id) ? new Set() : new Set([id]),
        );
      }
      anchorIndexRef.current = index;
    },
    [photos],
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(photos.map((p) => p.id)));
  }, [photos]);

  function clearSelection() {
    setSelectedIds(new Set());
    anchorIndexRef.current = null;
    setShowBulkTagInput(false);
    setBulkTagValue("");
    setConfirmingBulkDelete(false);
    setBulkError(null);
  }

  // In the dedicated Trash tab, trashed items are permanently deleted and
  // drop out of the list. Everywhere else, "delete" just adds the trash tag
  // — the photo stays visible in the (now trash-inclusive) library, marked
  // with the trash icon, so it just gets updated in place.
  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (trash && !confirmingBulkDelete) {
      setConfirmingBulkDelete(true);
      return;
    }
    setBulkPending(true);
    setBulkError(null);
    try {
      if (trash) {
        await bulkDeletePermanently(ids);
        setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
        setTotal((prev) => prev - ids.length);
      } else {
        const updated = await bulkAddTags(ids, [TRASH_TAG]);
        const byId = new Map(updated.map((p) => [p.id, p]));
        setPhotos((prev) => prev.map((p) => byId.get(p.id) ?? p));
      }
      clearSelection();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Failed to delete photos");
    } finally {
      setBulkPending(false);
    }
  }

  async function handleBulkAddTag() {
    const tag = bulkTagValue.trim();
    const ids = Array.from(selectedIds);
    if (!tag || ids.length === 0) return;
    setBulkPending(true);
    setBulkError(null);
    try {
      const updated = await bulkAddTags(ids, [tag]);
      const byId = new Map(updated.map((p) => [p.id, p]));
      setPhotos((prev) => prev.map((p) => byId.get(p.id) ?? p));
      setBulkTagValue("");
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Failed to tag photos");
    } finally {
      setBulkPending(false);
    }
  }

  const removeTagFromSelected = useCallback(
    async (tag: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      const updated = await bulkRemoveTags(ids, [tag]);
      const byId = new Map(updated.map((p) => [p.id, p]));
      setPhotos((prev) => prev.map((p) => byId.get(p.id) ?? p));
    },
    [selectedIds],
  );

  useImperativeHandle(ref, () => ({ removeTagFromSelected }), [removeTagFromSelected]);

  const hasMore = photos.length < total;
  const rowCount = Math.ceil(photos.length / columns);

  // Only rows near the viewport are mounted, so off-screen PhotoThumbs unmount
  // and release their decoded image + blob URL (see useAuthMedia's cleanup)
  // instead of accumulating in memory for the whole scroll session.
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 150,
    overscan: 4,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {error && <p className="text-red-600 text-sm mb-2 shrink-0">{error}</p>}
      <div className="shrink-0 mb-2 flex flex-wrap items-center gap-2 rounded border border-neutral-200 dark:border-neutral-800 px-3 py-2">
        <span className="text-sm text-neutral-500">{selectedIds.size} selected</span>
        <button
          type="button"
          onClick={selectAll}
          disabled={bulkPending || photos.length === 0}
          className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={clearSelection}
          disabled={bulkPending || selectedIds.size === 0}
          className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
        >
          Clear
        </button>
        {showBulkTagInput ? (
          <>
            <input
              type="text"
              autoFocus
              value={bulkTagValue}
              onChange={(e) => setBulkTagValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleBulkAddTag();
                }
              }}
              list="bulk-tag-suggestions"
              placeholder="e.g. people/alice"
              className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-transparent"
            />
            <datalist id="bulk-tag-suggestions">
              {tagSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={handleBulkAddTag}
              disabled={bulkPending || !bulkTagValue.trim()}
              className="px-3 py-1 text-sm rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-50 cursor-pointer"
            >
              Add tag
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowBulkTagInput(true)}
            disabled={bulkPending || selectedIds.size === 0}
            className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
          >
            Tag
          </button>
        )}
        {confirmingBulkDelete && (
          <span className="text-sm text-neutral-500 dark:text-neutral-300">Delete forever?</span>
        )}
        <button
          type="button"
          onClick={handleBulkDelete}
          disabled={bulkPending || selectedIds.size === 0}
          className="px-3 py-1 text-sm rounded bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 cursor-pointer"
        >
          {bulkPending
            ? trash
              ? "Deleting…"
              : "Moving to trash…"
            : confirmingBulkDelete
              ? "Yes, delete permanently"
              : trash
                ? "Delete permanently"
                : "Delete"}
        </button>
        {confirmingBulkDelete && (
          <button
            type="button"
            onClick={() => setConfirmingBulkDelete(false)}
            disabled={bulkPending}
            className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
        )}
        {bulkError && <span className="text-sm text-red-500">{bulkError}</span>}
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const start = virtualRow.index * columns;
            const rowPhotos = photos.slice(start, start + columns);
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
              >
                {rowPhotos.map((photo, i) => (
                  <PhotoThumb
                    key={photo.id}
                    photo={photo}
                    selected={selectedIds.has(photo.id)}
                    onSelect={(e) => handleSelect(start + i, photo.id, e)}
                    onOpen={() => setLightboxIndex(start + i)}
                  />
                ))}
              </div>
            );
          })}
        </div>
        {photos.length === 0 && !loading && (
          <p className="text-sm text-neutral-500 mt-4">
            {!trash && query === null ? "Enter a search above to see photos." : "No photos found."}
          </p>
        )}
        <div ref={sentinelRef} className="h-1" />
        {hasMore && loading && (
          <p className="text-sm text-neutral-500 text-center mt-4 pb-4">Loading more…</p>
        )}
      </div>
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          hasMore={hasMore}
          tagSuggestions={tagSuggestions}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onRequestMore={() => fetchPage(false)}
          onPhotoUpdate={(updated) => {
            // The dedicated Trash tab shows only trashed photos, so a
            // restore drops the photo out of that list. Every other view
            // (the trash-inclusive library) just updates the photo in
            // place — trashing/restoring it there only changes its icon.
            const stillBelongs = !trash || updated.tags.includes(TRASH_TAG);
            if (stillBelongs) {
              setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            } else {
              setPhotos((prev) => prev.filter((p) => p.id !== updated.id));
              setTotal((prev) => prev - 1);
              setLightboxIndex(null);
            }
          }}
          onPhotoDeleted={(id) => {
            setPhotos((prev) => prev.filter((p) => p.id !== id));
            setTotal((prev) => prev - 1);
            setLightboxIndex(null);
          }}
        />
      )}
    </div>
  );
});

export default PhotoGrid;
