"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { addTags, fileUrl, getPhoto, getTagTree, removeTag } from "@/lib/api";
import { flattenTagPaths } from "@/lib/tags";
import type { Photo } from "@/lib/types";
import TagChipsInput from "@/components/TagChipsInput";

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

export default function PhotoDetailPage(props: PageProps<"/photo/[id]">) {
  const { id } = use(props.params);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPhoto(id)
      .then(setPhoto)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    getTagTree()
      .then((tree) => setSuggestions(flattenTagPaths(tree)))
      .catch(() => {});
  }, [id]);

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600 text-sm">{error}</p>
        <Link href="/" className="text-sm text-blue-600">
          Back to library
        </Link>
      </div>
    );
  }

  if (!photo) {
    return <div className="p-4 text-sm text-neutral-500">Loading…</div>;
  }

  return (
    <div className="flex-1 p-4 max-w-4xl mx-auto w-full">
      <Link href="/" className="text-sm text-blue-600">
        ← Back to library
      </Link>
      <div className="mt-3 bg-neutral-100 dark:bg-neutral-900 rounded overflow-hidden flex items-center justify-center">
        {photo.media_type === "video" ? (
          <video src={fileUrl(photo.id)} controls className="max-h-[70vh] w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(photo.id)} alt={photo.original_filename} className="max-h-[70vh] w-full object-contain" />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
        <div>{photo.original_filename}</div>
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

      <div className="mt-4">
        <h2 className="text-sm font-medium mb-1">Tags</h2>
        <TagChipsInput
          tags={photo.tags}
          suggestions={suggestions}
          onAdd={async (tag) => {
            const updated = await addTags(photo.id, [tag]);
            setPhoto(updated);
          }}
          onRemove={async (tag) => {
            const updated = await removeTag(photo.id, tag);
            setPhoto(updated);
          }}
        />
      </div>
    </div>
  );
}
