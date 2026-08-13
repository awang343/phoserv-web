"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createGallery, listGalleries, thumbnailPath } from "@/lib/api";
import { useAuthMedia } from "@/lib/useAuthMedia";
import type { Gallery } from "@/lib/types";
import GalleryDetailView from "@/components/GalleryDetailView";
import GalleryReader from "@/components/GalleryReader";

function GalleryCard({
  gallery,
  onOpen,
  onRead,
}: {
  gallery: Gallery;
  onOpen: () => void;
  onRead: () => void;
}) {
  const src = useAuthMedia(gallery.cover_photo_id ? thumbnailPath(gallery.cover_photo_id, "sm") : null);
  return (
    <div className="relative rounded overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:border-blue-500">
      <button type="button" onClick={onOpen} className="block w-full text-left cursor-pointer">
        <div className="aspect-square bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={gallery.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-neutral-500">No pages</span>
          )}
        </div>
        <div className="p-2">
          <p className="text-sm font-medium truncate" title={gallery.title}>
            {gallery.title}
          </p>
          <p className="text-xs text-neutral-500">
            {gallery.photo_count} page{gallery.photo_count === 1 ? "" : "s"}
          </p>
          {gallery.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {gallery.tags.map((t) => (
                <span
                  key={t}
                  className="bg-neutral-200 dark:bg-neutral-800 rounded-full px-1.5 py-0.5 text-[10px]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
      {gallery.photo_count > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRead();
          }}
          aria-label="Open reader"
          title="Open reader"
          className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
        >
          ▶
        </button>
      )}
    </div>
  );
}

export default function GalleriesPanel({
  tag,
  onClearTag,
  photoTagSuggestions,
  galleryTagSuggestions,
}: {
  tag: string | null;
  onClearTag: () => void;
  photoTagSuggestions: string[];
  galleryTagSuggestions: string[];
}) {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [readerId, setReaderId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      setGalleries(await listGalleries(tag ?? undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load galleries");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    setSubmitting(true);
    setError(null);
    try {
      const g = await createGallery(title);
      setNewTitle("");
      setCreating(false);
      setGalleries((prev) => [g, ...prev]);
      setOpenId(g.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create gallery");
    } finally {
      setSubmitting(false);
    }
  }

  if (openId) {
    return (
      <GalleryDetailView
        galleryId={openId}
        photoTagSuggestions={photoTagSuggestions}
        galleryTagSuggestions={galleryTagSuggestions}
        onBack={() => {
          setOpenId(null);
          load();
        }}
        onDeleted={() => {
          setOpenId(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 mb-3 flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold">
          Galleries
          {tag && (
            <span className="ml-2 text-sm font-normal text-neutral-500">
              tagged <span className="font-medium">{tag}</span>{" "}
              <button type="button" onClick={onClearTag} className="text-blue-600 hover:underline cursor-pointer">
                (clear)
              </button>
            </span>
          )}
        </h1>
        {creating ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Gallery title"
              className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-transparent"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting || !newTitle.trim()}
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              disabled={submitting}
              className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white cursor-pointer"
          >
            New gallery
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-2 shrink-0">{error}</p>}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {galleries.length === 0 && !loading ? (
          <p className="text-sm text-neutral-500">No galleries yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {galleries.map((g) => (
              <GalleryCard
                key={g.id}
                gallery={g}
                onOpen={() => setOpenId(g.id)}
                onRead={() => setReaderId(g.id)}
              />
            ))}
          </div>
        )}
      </div>

      {readerId && <GalleryReader galleryId={readerId} onClose={() => setReaderId(null)} />}
    </div>
  );
}
