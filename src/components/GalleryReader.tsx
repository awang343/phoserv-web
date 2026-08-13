"use client";

import { useCallback, useEffect, useState } from "react";
import { getGallery, thumbnailPath } from "@/lib/api";
import { useAuthMedia } from "@/lib/useAuthMedia";
import type { GalleryDetail } from "@/lib/types";

function ReaderPage({ photoId, filename }: { photoId: string; filename: string }) {
  const src = useAuthMedia(thumbnailPath(photoId, "md"));
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={filename} className="max-w-full max-h-full object-contain select-none" />
  );
}

// Minimal fullscreen manga-style reader: just the page and a page counter,
// with click-to-turn (left half = prev, right half = next) plus arrow keys.
export default function GalleryReader({ galleryId, onClose }: { galleryId: string; onClose: () => void }) {
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGallery(galleryId)
      .then((g) => {
        if (!cancelled) setGallery(g);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load gallery");
      });
    return () => {
      cancelled = true;
    };
  }, [galleryId]);

  const photos = gallery?.photos ?? [];

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setIndex((i) => Math.min(photos.length - 1, i + 1));
  }, [photos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close reader"
        className="absolute top-4 right-4 z-10 text-white/70 hover:text-white text-2xl leading-none cursor-pointer"
      >
        ×
      </button>

      {error && <p className="m-auto text-sm text-red-400">{error}</p>}
      {!error && !gallery && <p className="m-auto text-sm text-neutral-400">Loading…</p>}
      {!error && gallery && photos.length === 0 && (
        <p className="m-auto text-sm text-neutral-400">No pages in this gallery.</p>
      )}

      {!error && photos.length > 0 && (
        <>
          <div
            className="flex-1 min-h-0 flex items-center justify-center cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (e.clientX - rect.left < rect.width / 2) goPrev();
              else goNext();
            }}
          >
            <ReaderPage photoId={photos[index].id} filename={photos[index].original_filename} />
          </div>
          <div className="shrink-0 py-2 text-center text-white/70 text-sm">
            Page {index + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
