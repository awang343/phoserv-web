"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addTags,
  deletePhotoPermanently,
  filePath,
  regenerateThumbnail,
  removeTag,
  thumbnailPath,
  TRASH_TAG,
} from "@/lib/api";
import { useAuthMedia } from "@/lib/useAuthMedia";
import type { Photo } from "@/lib/types";
import TagChipsInput from "@/components/TagChipsInput";
import GalleryPicker from "@/components/GalleryPicker";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

export default function PhotoLightbox({
  photos,
  index,
  hasMore,
  tagSuggestions = [],
  pageLabel,
  onClose,
  onIndexChange,
  onPhotoUpdate,
  onPhotoDeleted,
  onRequestMore,
}: {
  photos: Photo[];
  index: number;
  hasMore: boolean;
  tagSuggestions?: string[];
  /** Optional "Page X / N" style label shown near the close button — used by the gallery reader. */
  pageLabel?: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  onPhotoUpdate: (photo: Photo) => void;
  onPhotoDeleted: (photoId: string) => void;
  onRequestMore: () => Promise<void>;
}) {
  const photo = photos[index];
  const [pending, setPending] = useState<"regenerate" | "trash" | "delete" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [seenPhotoId, setSeenPhotoId] = useState<string | undefined>(photo?.id);
  const [videoRequested, setVideoRequested] = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  // Images show the pre-generated "md" thumbnail instead of the full
  // original — much smaller download for the same on-screen size. Videos
  // show that same thumbnail until the user explicitly asks to play, since
  // downloading the full file up front made the lightbox feel like it hung.
  const showVideoFile = photo?.media_type === "video" && videoRequested;
  const mediaPath = photo ? (showVideoFile ? filePath(photo.id) : thumbnailPath(photo.id, "md")) : null;
  const mediaSrc = useAuthMedia(mediaPath);

  if (photo?.id !== seenPhotoId) {
    setSeenPhotoId(photo?.id);
    setActionError(null);
    setConfirmingDelete(false);
    setVideoRequested(false);
    setShowGalleryPicker(false);
  }

  async function handleRegenerateThumbnail() {
    setPending("regenerate");
    setActionError(null);
    try {
      const updated = await regenerateThumbnail(photo.id);
      onPhotoUpdate(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to regenerate thumbnail");
    } finally {
      setPending(null);
    }
  }

  async function handleMoveToTrash() {
    setPending("trash");
    setActionError(null);
    try {
      const updated = await addTags(photo.id, [TRASH_TAG]);
      onPhotoUpdate(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to move photo to trash");
    } finally {
      setPending(null);
    }
  }

  async function handleRestore() {
    setPending("trash");
    setActionError(null);
    try {
      const updated = await removeTag(photo.id, TRASH_TAG);
      onPhotoUpdate(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to restore photo");
    } finally {
      setPending(null);
    }
  }

  async function handleDeletePermanently() {
    setPending("delete");
    setActionError(null);
    try {
      await deletePhotoPermanently(photo.id);
      setConfirmingDelete(false);
      onPhotoDeleted(photo.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete photo");
    } finally {
      setPending(null);
    }
  }

  const canGoPrev = index > 0;
  const canGoNext = index + 1 < photos.length || hasMore;

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index + 1 < photos.length) {
      onIndexChange(index + 1);
    } else if (hasMore) {
      onRequestMore().then(() => onIndexChange(index + 1));
    }
  }, [index, photos.length, hasMore, onIndexChange, onRequestMore]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  if (!photo) return null;

  // Whether to show "Restore"/"Delete permanently" vs. plain "Delete"
  // depends on the photo's own trash status, not which tab it's being
  // viewed from — the library now shows trashed photos inline too.
  const isTrashed = photo.tags.includes(TRASH_TAG);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      {pageLabel && (
        <span className="absolute top-4 left-4 text-white/70 text-sm">{pageLabel}</span>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none cursor-pointer"
      >
        ×
      </button>

      {canGoPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous photo"
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl px-2 py-4 cursor-pointer"
        >
          ‹
        </button>
      )}
      {canGoNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next photo"
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl px-2 py-4 cursor-pointer"
        >
          ›
        </button>
      )}

      <div
        className="max-w-4xl w-full max-h-full overflow-y-auto bg-neutral-950 rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-black flex items-center justify-center">
          {mediaSrc && photo.media_type === "video" && showVideoFile && (
            <video src={mediaSrc} controls autoPlay className="max-h-[70vh] w-full" />
          )}
          {mediaSrc && photo.media_type === "video" && !showVideoFile && (
            <button
              type="button"
              onClick={() => setVideoRequested(true)}
              aria-label="Play video"
              className="relative w-full cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaSrc} alt={photo.original_filename} className="max-h-[70vh] w-full object-contain" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex items-center justify-center w-16 h-16 rounded-full bg-black/60 text-white text-3xl">
                  ▶
                </span>
              </span>
            </button>
          )}
          {mediaSrc && photo.media_type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaSrc} alt={photo.original_filename} className="max-h-[70vh] w-full object-contain" />
          )}
        </div>

        <div className="p-4 text-white">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-400">
            <div className="truncate" title={photo.original_filename}>
              {photo.original_filename}
            </div>
            <div>{formatBytes(photo.file_size)}</div>
            {photo.width && photo.height && (
              <div>
                {photo.width} × {photo.height}
              </div>
            )}
            {photo.duration_seconds != null && <div>{photo.duration_seconds.toFixed(1)}s</div>}
            <div>Uploaded {new Date(photo.created_at).toLocaleString()}</div>
            {photo.taken_at && <div>Taken {photo.taken_at}</div>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRegenerateThumbnail}
              disabled={pending !== null}
              className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
            >
              {pending === "regenerate" ? "Regenerating thumbnail…" : "Regenerate thumbnail"}
            </button>

            <button
              type="button"
              onClick={() => setShowGalleryPicker(true)}
              disabled={pending !== null}
              className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
            >
              Add to gallery
            </button>

            {isTrashed ? (
              <>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={pending !== null}
                  className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
                >
                  {pending === "trash" ? "Restoring…" : "Restore"}
                </button>
                {confirmingDelete ? (
                  <>
                    <span className="px-3 py-1 text-sm text-neutral-300">Delete forever?</span>
                    <button
                      type="button"
                      onClick={handleDeletePermanently}
                      disabled={pending !== null}
                      className="px-3 py-1 text-sm rounded bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 cursor-pointer"
                    >
                      {pending === "delete" ? "Deleting…" : "Yes, delete permanently"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={pending !== null}
                      className="px-3 py-1 text-sm rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={pending !== null}
                    className="px-3 py-1 text-sm rounded bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 cursor-pointer"
                  >
                    Delete permanently
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleMoveToTrash}
                disabled={pending !== null}
                className="px-3 py-1 text-sm rounded bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 cursor-pointer"
              >
                {pending === "trash" ? "Moving to trash…" : "Delete"}
              </button>
            )}
          </div>
          {actionError && <p className="mt-1 text-sm text-red-500">{actionError}</p>}

          <div className="mt-4">
            <h2 className="text-sm font-medium mb-1">Tags</h2>
            <TagChipsInput
              tags={photo.tags}
              suggestions={tagSuggestions}
              onAdd={async (tag) => {
                const updated = await addTags(photo.id, [tag]);
                onPhotoUpdate(updated);
              }}
              onRemove={async (tag) => {
                const updated = await removeTag(photo.id, tag);
                onPhotoUpdate(updated);
              }}
            />
          </div>
        </div>
      </div>

      {showGalleryPicker && (
        <GalleryPicker photoId={photo.id} onClose={() => setShowGalleryPicker(false)} />
      )}
    </div>
  );
}
