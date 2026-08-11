"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { listPhotos, thumbnailUrl } from "@/lib/api";
import type { Photo } from "@/lib/types";

const PAGE_SIZE = 60;

export default function PhotoGrid({ tag }: { tag: string | null }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      const offset = reset ? 0 : offsetRef.current;
      try {
        const res = await listPhotos({ tag: tag ?? undefined, limit: PAGE_SIZE, offset });
        setPhotos((prev) => (reset ? res.photos : [...prev, ...res.photos]));
        setTotal(res.total);
        offsetRef.current = offset + res.photos.length;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [tag],
  );

  useEffect(() => {
    offsetRef.current = 0;
    fetchPage(true);
  }, [fetchPage]);

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

  const hasMore = photos.length < total;

  return (
    <div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {photos.map((photo) => (
          <Link
            key={photo.id}
            href={`/photo/${photo.id}`}
            className="aspect-square block overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl(photo.id, "sm")}
              alt={photo.original_filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </Link>
        ))}
      </div>
      {photos.length === 0 && !loading && (
        <p className="text-sm text-neutral-500 mt-4">No photos found.</p>
      )}
      <div ref={sentinelRef} className="h-1" />
      {hasMore && loading && (
        <p className="text-sm text-neutral-500 text-center mt-4">Loading more…</p>
      )}
    </div>
  );
}
