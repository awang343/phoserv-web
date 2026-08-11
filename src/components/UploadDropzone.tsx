"use client";

import { useEffect, useState } from "react";
import { getTagTree, uploadPhoto } from "@/lib/api";
import { flattenTagPaths } from "@/lib/tags";
import TagChipsInput from "./TagChipsInput";

type FileStatus = "pending" | "uploading" | "done" | "error";

interface QueuedFile {
  file: File;
  status: FileStatus;
  error?: string;
}

export default function UploadDropzone() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getTagTree()
      .then((tree) => setSuggestions(flattenTagPaths(tree)))
      .catch(() => {});
  }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const next = Array.from(fileList).map((file) => ({ file, status: "pending" as FileStatus }));
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAll = async () => {
    setSubmitting(true);
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "done") continue;
      setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f)));
      try {
        await uploadPhoto(files[i].file, tags);
        setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "done" } : f)));
      } catch (err) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: err instanceof Error ? err.message : String(err) } : f,
          ),
        );
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
          suggestions={suggestions}
          onAdd={(tag) => setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))}
          onRemove={(tag) => setTags((prev) => prev.filter((t) => t !== tag))}
        />
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
