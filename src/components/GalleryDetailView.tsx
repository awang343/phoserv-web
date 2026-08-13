"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addGalleryTags,
  addPhotosToGallery,
  deleteGallery,
  getGallery,
  removeGalleryTag,
  removePhotosFromGallery,
  reorderGallery,
  thumbnailPath,
  updateGallery,
  TRASH_TAG,
} from "@/lib/api";
import { useAuthMedia } from "@/lib/useAuthMedia";
import type { GalleryDetail, Photo } from "@/lib/types";
import TagChipsInput from "@/components/TagChipsInput";
import PhotoLightbox from "@/components/PhotoLightbox";
import GalleryPhotoPicker from "@/components/GalleryPhotoPicker";

function PageThumb({
  photo,
  position,
  onOpen,
  onMoveLeft,
  onMoveRight,
  onRemove,
  canMoveLeft,
  canMoveRight,
  disabled,
}: {
  photo: Photo;
  position: number;
  onOpen: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  disabled: boolean;
}) {
  const src = useAuthMedia(thumbnailPath(photo.id, "sm"));
  return (
    <div className="relative bg-neutral-100 dark:bg-neutral-900 p-1">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full aspect-square overflow-hidden cursor-pointer"
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={photo.original_filename} className="w-full h-full object-cover" />
        )}
      </button>
      <span className="absolute top-1 left-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-black/60 text-white text-xs">
        {position}
      </span>
      <div className="absolute bottom-1 right-1 flex gap-0.5">
        <button
          type="button"
          onClick={onMoveLeft}
          disabled={disabled || !canMoveLeft}
          aria-label="Move earlier"
          className="w-5 h-5 flex items-center justify-center rounded bg-black/60 text-white text-xs disabled:opacity-30 cursor-pointer"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={onMoveRight}
          disabled={disabled || !canMoveRight}
          aria-label="Move later"
          className="w-5 h-5 flex items-center justify-center rounded bg-black/60 text-white text-xs disabled:opacity-30 cursor-pointer"
        >
          ›
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove from gallery"
          className="w-5 h-5 flex items-center justify-center rounded bg-black/60 text-white text-xs hover:bg-red-700 disabled:opacity-30 cursor-pointer"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function GalleryDetailView({
  galleryId,
  photoTagSuggestions,
  galleryTagSuggestions,
  onBack,
  onDeleted,
}: {
  galleryId: string;
  photoTagSuggestions: string[];
  galleryTagSuggestions: string[];
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [readerIndex, setReaderIndex] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const g = await getGallery(galleryId);
      setGallery(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  }, [galleryId]);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  function startEditing() {
    if (!gallery) return;
    setTitleValue(gallery.title);
    setDescValue(gallery.description ?? "");
    setEditing(true);
  }

  async function saveMetadata() {
    if (!gallery) return;
    const title = titleValue.trim();
    if (!title) return;
    setSaving(true);
    try {
      await updateGallery(gallery.id, { title, description: descValue });
      setGallery({ ...gallery, title, description: descValue });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update gallery");
    } finally {
      setSaving(false);
    }
  }

  async function move(index: number, delta: number) {
    if (!gallery || reordering) return;
    const target = index + delta;
    if (target < 0 || target >= gallery.photos.length) return;
    const photos = gallery.photos.slice();
    [photos[index], photos[target]] = [photos[target], photos[index]];
    setGallery({ ...gallery, photos });
    setReordering(true);
    try {
      await reorderGallery(gallery.id, photos.map((p) => p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reorder gallery");
      load();
    } finally {
      setReordering(false);
    }
  }

  async function removePhoto(photoId: string) {
    if (!gallery) return;
    try {
      const updated = await removePhotosFromGallery(gallery.id, [photoId]);
      setGallery(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove photo");
    }
  }

  async function handleDeleteGallery() {
    if (!gallery) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteGallery(gallery.id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete gallery");
      setDeleting(false);
    }
  }

  if (loading && !gallery) {
    return <p className="text-sm text-neutral-500 p-4">Loading…</p>;
  }
  if (!gallery) {
    return (
      <div className="p-4">
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <button type="button" onClick={onBack} className="text-sm text-blue-600 cursor-pointer">
          ← Back to galleries
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 mb-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-blue-600 hover:underline cursor-pointer mb-2"
        >
          ← Back to galleries
        </button>
        {editing ? (
          <div className="space-y-2 max-w-lg">
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              autoFocus
              className="w-full border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-lg font-semibold bg-transparent"
            />
            <textarea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-transparent"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveMetadata}
                disabled={saving || !titleValue.trim()}
                className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">{gallery.title}</h1>
              {gallery.description && (
                <p className="text-sm text-neutral-500 mt-0.5">{gallery.description}</p>
              )}
              <p className="text-xs text-neutral-500 mt-0.5">
                {gallery.photos.length} page{gallery.photos.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={startEditing}
                className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDeleteGallery}
                disabled={deleting}
                className="px-3 py-1 text-sm rounded bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Deleting…" : confirmingDelete ? "Confirm delete" : "Delete gallery"}
              </button>
              {confirmingDelete && !deleting && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 max-w-lg">
          <h2 className="text-xs font-semibold uppercase text-neutral-500 mb-1">Gallery tags</h2>
          <TagChipsInput
            tags={gallery.tags}
            suggestions={galleryTagSuggestions}
            onAdd={async (tag) => {
              const updated = await addGalleryTags(gallery.id, [tag]);
              setGallery({ ...gallery, tags: updated.tags });
            }}
            onRemove={async (tag) => {
              const updated = await removeGalleryTag(gallery.id, tag);
              setGallery({ ...gallery, tags: updated.tags });
            }}
          />
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase text-neutral-500">Pages</h2>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 cursor-pointer"
          >
            Add photos
          </button>
        </div>
        {gallery.photos.length === 0 ? (
          <p className="text-sm text-neutral-500">No pages yet — add some photos.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {gallery.photos.map((photo, i) => (
              <PageThumb
                key={photo.id}
                photo={photo}
                position={i + 1}
                onOpen={() => setReaderIndex(i)}
                onMoveLeft={() => move(i, -1)}
                onMoveRight={() => move(i, 1)}
                onRemove={() => removePhoto(photo.id)}
                canMoveLeft={i > 0}
                canMoveRight={i < gallery.photos.length - 1}
                disabled={reordering}
              />
            ))}
          </div>
        )}
      </div>

      {showPicker && (
        <GalleryPhotoPicker
          onConfirm={async (photoIds) => {
            const updated = await addPhotosToGallery(gallery.id, photoIds);
            setGallery(updated);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {readerIndex !== null && (
        <PhotoLightbox
          photos={gallery.photos}
          index={readerIndex}
          hasMore={false}
          tagSuggestions={photoTagSuggestions}
          pageLabel={`Page ${readerIndex + 1} / ${gallery.photos.length}`}
          onClose={() => setReaderIndex(null)}
          onIndexChange={setReaderIndex}
          onRequestMore={async () => {}}
          onPhotoUpdate={(updated) => {
            if (updated.tags.includes(TRASH_TAG)) {
              const photos = gallery.photos.filter((p) => p.id !== updated.id);
              setGallery({ ...gallery, photos });
              setReaderIndex(null);
            } else {
              setGallery({
                ...gallery,
                photos: gallery.photos.map((p) => (p.id === updated.id ? updated : p)),
              });
            }
          }}
          onPhotoDeleted={(id) => {
            setGallery({ ...gallery, photos: gallery.photos.filter((p) => p.id !== id) });
            setReaderIndex(null);
          }}
        />
      )}
    </div>
  );
}
