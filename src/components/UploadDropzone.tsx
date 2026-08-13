"use client";

import { useEffect, useState } from "react";
import { addPhotosToGallery, createGallery, listGalleries, uploadPhoto } from "@/lib/api";
import type { Gallery } from "@/lib/types";
import TagChipsInput from "./TagChipsInput";

type FileStatus = "pending" | "uploading" | "done" | "error";

interface QueuedFile {
  file: File;
  status: FileStatus;
  error?: string;
  photoId?: string;
}

const NEW_GALLERY = "__new__";

// Keeps the queue in filename order so a folder of "page01.jpg, page02.jpg, ..."
// uploads (and lands in the target gallery) in the same order regardless of
// the order the OS/browser handed us the files in.
function sortByName(files: QueuedFile[]): QueuedFile[] {
  return [...files].sort((a, b) =>
    a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: "base" }),
  );
}

export default function UploadDropzone({
  tagSuggestions = [],
}: {
  tagSuggestions?: string[];
}) {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [targetGallery, setTargetGallery] = useState("");
  const [newGalleryTitle, setNewGalleryTitle] = useState("");
  const [galleryResult, setGalleryResult] = useState<string | null>(null);

  useEffect(() => {
    listGalleries()
      .then(setGalleries)
      .catch(() => {});
  }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const next = Array.from(fileList).map((file) => ({ file, status: "pending" as FileStatus }));
    setFiles((prev) => sortByName([...prev, ...next]));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAll = async () => {
    setSubmitting(true);
    setGalleryResult(null);
    const uploadedIds: string[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "done") {
        if (files[i].photoId) uploadedIds.push(files[i].photoId!);
        continue;
      }
      setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f)));
      try {
        const photo = await uploadPhoto(files[i].file, tags);
        uploadedIds.push(photo.id);
        setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "done", photoId: photo.id } : f)));
      } catch (err) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: err instanceof Error ? err.message : String(err) } : f,
          ),
        );
      }
    }

    if (targetGallery && uploadedIds.length > 0) {
      try {
        let galleryId = targetGallery;
        let title = galleries.find((g) => g.id === targetGallery)?.title ?? "";
        if (targetGallery === NEW_GALLERY) {
          const trimmedTitle = newGalleryTitle.trim();
          if (!trimmedTitle) {
            setGalleryResult("Enter a title for the new gallery before uploading.");
            setSubmitting(false);
            return;
          }
          const created = await createGallery(trimmedTitle);
          galleryId = created.id;
          title = created.title;
          setGalleries((prev) => [created, ...prev]);
          setTargetGallery(created.id);
          setNewGalleryTitle("");
        }
        await addPhotosToGallery(galleryId, uploadedIds);
        setGalleryResult(`Added ${uploadedIds.length} photo${uploadedIds.length === 1 ? "" : "s"} to "${title}".`);
      } catch (e) {
        setGalleryResult(e instanceof Error ? e.message : "Failed to add photos to gallery");
      }
    }

    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          dragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
          Drag and drop photos or videos here, or
        </p>
        <label className="inline-block px-3 py-1.5 text-sm rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 cursor-pointer">
          Choose files
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
      </div>

      <div>
        <p className="text-sm font-medium mb-1">Tags (applied to all files in this batch)</p>
        <TagChipsInput
          tags={tags}
          suggestions={tagSuggestions}
          onAdd={(tag) => setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))}
          onRemove={(tag) => setTags((prev) => prev.filter((t) => t !== tag))}
        />
      </div>

      <div>
        <p className="text-sm font-medium mb-1">Add to gallery (uploaded in filename order)</p>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={targetGallery}
            onChange={(e) => setTargetGallery(e.target.value)}
            className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-transparent"
          >
            <option value="">None</option>
            {galleries.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
            <option value={NEW_GALLERY}>+ New gallery…</option>
          </select>
          {targetGallery === NEW_GALLERY && (
            <input
              type="text"
              autoFocus
              value={newGalleryTitle}
              onChange={(e) => setNewGalleryTitle(e.target.value)}
              placeholder="Gallery title"
              className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-transparent"
            />
          )}
        </div>
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="truncate">{f.file.name}</span>
              <div className="flex items-center gap-2">
                <span
                  className={
                    f.status === "done"
                      ? "text-green-600"
                      : f.status === "error"
                        ? "text-red-600"
                        : f.status === "uploading"
                          ? "text-blue-600"
                          : "text-neutral-500"
                  }
                >
                  {f.status === "error" ? f.error : f.status}
                </span>
                {f.status !== "uploading" && (
                  <button type="button" onClick={() => removeFile(i)} className="text-neutral-500 hover:text-red-600">
                    ×
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {galleryResult && <p className="text-sm text-neutral-600 dark:text-neutral-400">{galleryResult}</p>}

      <button
        type="button"
        disabled={files.length === 0 || submitting}
        onClick={uploadAll}
        className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
      >
        {submitting ? "Uploading…" : `Upload ${files.length || ""} file${files.length === 1 ? "" : "s"}`.trim()}
      </button>
    </div>
  );
}
