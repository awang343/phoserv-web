"use client";

import { useEffect, useRef, useState } from "react";
import { addPhotosToGallery, createGallery, listGalleries } from "@/lib/api";
import type { Gallery } from "@/lib/types";

/**
 * Modal that lets the user add a single photo (from the lightbox) to one or
 * more existing galleries, or create a new gallery to hold it. Stays open
 * across multiple adds so the user can add to several galleries in one go.
 */
export default function GalleryPicker({
  photoId,
  onClose,
}: {
  photoId: string;
  onClose: () => void;
}) {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        setGalleries(await listGalleries());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load galleries");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function addTo(gallery: Gallery) {
    setAddingId(gallery.id);
    setError(null);
    try {
      await addPhotosToGallery(gallery.id, [photoId]);
      setAddedIds((prev) => new Set(prev).add(gallery.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add photo to gallery");
    } finally {
      setAddingId(null);
    }
  }

  async function createAndAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    setError(null);
    try {
      const gallery = await createGallery(title);
      setGalleries((prev) => [gallery, ...prev]);
      setNewTitle("");
      await addTo(gallery);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create gallery");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-white dark:bg-neutral-950 rounded max-w-sm w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <h2 className="text-sm font-semibold">Add to gallery</h2>
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
          {loading && <p className="text-sm text-neutral-500">Loading…</p>}
          {!loading && galleries.length === 0 && (
            <p className="text-sm text-neutral-500">No galleries yet.</p>
          )}
          <ul className="space-y-1">
            {galleries.map((gallery) => {
              const added = addedIds.has(gallery.id);
              return (
                <li key={gallery.id}>
                  <button
                    type="button"
                    onClick={() => addTo(gallery)}
                    disabled={addingId !== null || added}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded disabled:opacity-50 cursor-pointer ${
                      added
                        ? "bg-green-700 text-white"
                        : "bg-neutral-800 text-white hover:bg-neutral-700"
                    }`}
                  >
                    <span className="truncate">{gallery.title}</span>
                    <span className="ml-2 shrink-0 text-xs text-neutral-300">
                      {added ? "Added" : addingId === gallery.id ? "Adding…" : `${gallery.photo_count} photos`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 shrink-0 flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createAndAdd();
            }}
            placeholder="New gallery name"
            className="flex-1 min-w-0 px-2 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
          />
          <button
            type="button"
            onClick={createAndAdd}
            disabled={creating || !newTitle.trim()}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:opacity-50 cursor-pointer shrink-0"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
