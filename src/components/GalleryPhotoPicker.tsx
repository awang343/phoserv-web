"use client";

import { useEffect, useRef, useState } from "react";
import { listPhotos, thumbnailPath } from "@/lib/api";
import { useAuthMedia } from "@/lib/useAuthMedia";
import type { Photo } from "@/lib/types";

const PAGE_SIZE = 60;

function PickerThumb({
  photo,
  order,
  onToggle,
}: {
  photo: Photo;
  order: number | null;
  onToggle: () => void;
}) {
  const src = useAuthMedia(thumbnailPath(photo.id, "sm"));
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative aspect-square block overflow-hidden p-1 ${
        order !== null ? "bg-blue-500" : "bg-neutral-100 dark:bg-neutral-900"
      }`}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={photo.original_filename} className="w-full h-full object-cover" />
      )}
      {order !== null && (
        <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">
          {order}
        </span>
      )}
    </button>
  );
}

/**
 * Modal photo picker used to add existing library photos to a gallery.
 * Selection order is tracked (not a Set) so the click order becomes the
 * page order photos are appended to the gallery in.
 */
export default function GalleryPhotoPicker({
  onConfirm,
  onClose,
}: {
  onConfirm: (photoIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listPhotos({ limit: PAGE_SIZE, cursor: cursor ?? undefined });
      setPhotos((prev) => [...prev, ...res.photos]);
      setCursor(res.next_cursor);
      setHasMore(res.next_cursor !== null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load photos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function confirm() {
    if (selected.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(selected);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add photos");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-950 rounded max-w-3xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <h2 className="text-sm font-semibold">
            Add photos {selected.length > 0 && `(${selected.length} selected)`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
            {photos.map((photo) => (
              <PickerThumb
                key={photo.id}
                photo={photo}
                order={selected.includes(photo.id) ? selected.indexOf(photo.id) + 1 : null}
                onToggle={() => toggle(photo.id)}
              />
            ))}
          </div>
          {photos.length === 0 && !loading && (
            <p className="text-sm text-neutral-500 mt-4">No photos found.</p>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="w-full mt-3 py-1.5 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 shrink-0 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={submitting || selected.length === 0}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Adding…" : `Add ${selected.length || ""} photo${selected.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
