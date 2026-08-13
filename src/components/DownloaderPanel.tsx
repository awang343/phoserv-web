"use client";

import { useEffect, useRef, useState } from "react";
import { addPhotosToGallery, createGallery, getDownloaderJob, listDownloaders, runDownloader } from "@/lib/api";
import type { DownloaderInfo, DownloaderJob, ImportFileResult } from "@/lib/types";

const STATUS_LABEL: Record<ImportFileResult["status"], string> = {
  dry_run: "would import",
  uploaded: "uploaded",
  tagged: "tagged (already existed)",
  skipped: "skipped (no new tags)",
  error: "error",
};

const STATUS_CLASS: Record<ImportFileResult["status"], string> = {
  dry_run: "text-neutral-500",
  uploaded: "text-green-600",
  tagged: "text-blue-600",
  skipped: "text-neutral-500",
  error: "text-red-600",
};

const POLL_INTERVAL_MS = 1000;

type GalleryCreationStatus =
  | { state: "creating" }
  | { state: "done"; galleryId: string; name: string; count: number }
  | { state: "error"; error: string };

export default function DownloaderPanel() {
  const [downloaders, setDownloaders] = useState<DownloaderInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [url, setUrl] = useState("");
  const [galleryName, setGalleryName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<DownloaderJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [galleryStatus, setGalleryStatus] = useState<GalleryCreationStatus | null>(null);
  const handledGalleryJobId = useRef<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    listDownloaders()
      .then((list) => {
        setDownloaders(list);
        if (list.length > 0) setSelected(list[0].name);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    if (!job || job.status !== "running") return;
    const timer = setInterval(async () => {
      try {
        const updated = await getDownloaderJob(job.id);
        setJob(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [job]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [job?.log.length]);

  // Once a job finishes (successfully or not), bundle whatever it imported
  // into a new gallery, if the user named one. Runs once per job id -- the
  // ref guards against re-firing on every poll tick after completion.
  useEffect(() => {
    if (!job || job.status === "running") return;
    const name = galleryName.trim();
    if (!name) return;
    if (handledGalleryJobId.current === job.id) return;
    handledGalleryJobId.current = job.id;

    const photoIds = job.results.map((r) => r.photo_id).filter((id): id is string => id !== null);
    if (photoIds.length === 0) return;

    (async () => {
      setGalleryStatus({ state: "creating" });
      try {
        const gallery = await createGallery(name);
        await addPhotosToGallery(gallery.id, photoIds);
        setGalleryStatus({ state: "done", galleryId: gallery.id, name, count: photoIds.length });
      } catch (err) {
        setGalleryStatus({ state: "error", error: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, [job, galleryName]);

  const run = async () => {
    if (!selected) {
      setError("Select a downloader script.");
      return;
    }
    if (!url.trim()) {
      setError("Enter a URL.");
      return;
    }
    setStarting(true);
    setError(null);
    setJob(null);
    setGalleryStatus(null);
    handledGalleryJobId.current = null;
    try {
      const { job_id } = await runDownloader(selected, url.trim());
      const initial = await getDownloaderJob(job_id);
      setJob(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const busy = starting || job?.status === "running";

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Run one of your own downloader scripts on the server to fetch content from a URL and import it.
        Each script decides what to download and what tags to attach; the server just runs it and imports
        whatever it reports.
      </p>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {downloaders !== null && downloaders.length === 0 && !loadError && (
        <p className="text-sm text-neutral-500">
          No downloader scripts configured. Set <code className="font-mono">downloaders_path</code> in the
          server config to a directory of executable scripts to enable this.
        </p>
      )}

      {downloaders !== null && downloaders.length > 0 && (
        <>
          <div>
            <label htmlFor="downloader-select" className="block text-sm font-medium mb-1">
              Downloader
            </label>
            <select
              id="downloader-select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            >
              {downloaders.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="downloader-url" className="block text-sm font-medium mb-1">
              URL
            </label>
            <input
              id="downloader-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/..."
              className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <label htmlFor="downloader-gallery" className="block text-sm font-medium mb-1">
              Add to new gallery (optional)
            </label>
            <input
              id="downloader-gallery"
              type="text"
              value={galleryName}
              onChange={(e) => setGalleryName(e.target.value)}
              placeholder="e.g. Vacation 2024"
              className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-neutral-500">
              When set, a new gallery with this name is created once the run finishes, containing every photo it
              imported.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={run}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            {busy ? "Running…" : "Run"}
          </button>
        </>
      )}

      {job && (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {job.status === "running" && "Running…"}
            {job.status === "completed" && "Completed"}
            {job.status === "failed" && "Failed"}
            {" · scanned "}
            {job.summary.scanned} · uploaded {job.summary.uploaded} · tagged {job.summary.tagged} · skipped{" "}
            {job.summary.skipped} · errors {job.summary.errors}
          </p>

          {galleryStatus?.state === "creating" && <p className="text-sm text-neutral-500">Creating gallery…</p>}
          {galleryStatus?.state === "done" && (
            <p className="text-sm text-green-600">
              Created gallery &quot;{galleryStatus.name}&quot; with {galleryStatus.count} photo
              {galleryStatus.count === 1 ? "" : "s"}.
            </p>
          )}
          {galleryStatus?.state === "error" && (
            <p className="text-sm text-red-600">Failed to create gallery: {galleryStatus.error}</p>
          )}

          {job.log.length > 0 && (
            <pre
              ref={logRef}
              className="text-xs font-mono bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded p-2 max-h-48 overflow-y-auto whitespace-pre-wrap"
            >
              {job.log.join("\n")}
            </pre>
          )}

          {job.results.length > 0 && (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded max-h-96 overflow-y-auto">
              {job.results.map((r, i) => (
                <li key={`${r.path}-${i}`} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs" title={r.path}>
                      {r.path}
                    </span>
                    <span className={`shrink-0 ${STATUS_CLASS[r.status]}`}>{r.error ?? STATUS_LABEL[r.status]}</span>
                  </div>
                  {r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-block bg-neutral-200 dark:bg-neutral-800 rounded-full px-2 py-0.5 text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
