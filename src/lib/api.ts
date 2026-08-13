import type {
  DownloaderInfo,
  DownloaderJob,
  Gallery,
  GalleryDetail,
  ImportPathResponse,
  ImportTagRule,
  Photo,
  PhotoListResponse,
  TagNode,
} from "./types";
import { getConfig } from "./config";

export class NotConfiguredError extends Error {
  constructor() {
    super("phoserv server is not configured. Go to Settings to connect to your server.");
  }
}

function requireConfig() {
  const cfg = getConfig();
  if (!cfg) throw new NotConfiguredError();
  return cfg;
}

function apiUrl(path: string): string {
  return `${requireConfig().url}/api${path}`;
}

function authHeaders(extra?: Record<string, string>): HeadersInit {
  return { Authorization: `Bearer ${requireConfig().token}`, ...extra };
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// Reserved top-level tag used to mark photos as soft-deleted ("trash").
// Kept out of the tag tree/autocomplete server-side (see tags::TRASH_TAG).
export const TRASH_TAG = "trash";

export async function listPhotos(opts: {
  // Boolean search query over tags (AND/OR/NOT, `-tag` shorthand, parens for
  // grouping), parsed server-side. Omit to skip filtering entirely; pass ""
  // explicitly to search with no filter (i.e. match everything).
  q?: string;
  limit?: number;
  cursor?: string;
  trash?: boolean;
}): Promise<PhotoListResponse> {
  const params = new URLSearchParams();
  if (opts.q !== undefined) params.set("q", opts.q);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.trash) params.set("trash", "true");
  const res = await fetch(`${apiUrl("/photos")}?${params.toString()}`, { headers: authHeaders() });
  return unwrap(res);
}

export async function getTagTree(): Promise<TagNode[]> {
  const res = await fetch(apiUrl("/tags"), { headers: authHeaders() });
  return unwrap(res);
}

export async function renameTag(id: number, name: string): Promise<TagNode[]> {
  const res = await fetch(apiUrl(`/tags/${id}`), {
    method: "PATCH",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  return unwrap(res);
}

export async function deleteTag(id: number): Promise<TagNode[]> {
  const res = await fetch(apiUrl(`/tags/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  return unwrap(res);
}

export async function uploadPhoto(file: File, tags: string[]): Promise<Photo> {
  const form = new FormData();
  form.append("file", file);
  for (const tag of tags) {
    if (tag.trim()) form.append("tags", tag.trim());
  }
  const res = await fetch(apiUrl("/photos"), { method: "POST", headers: authHeaders(), body: form });
  return unwrap(res);
}

// Imports photos/videos from a path *on the phoserv server's own
// filesystem* (as opposed to uploadPhoto, which sends bytes from the
// browser). Tags can be derived per-file from regex rules matched against
// each file's complete path — see ImportTagRule.
export async function importFromPath(opts: {
  path: string;
  recursive: boolean;
  tags: string[];
  tagRules: ImportTagRule[];
  lowercaseTags: boolean;
  dryRun: boolean;
}): Promise<ImportPathResponse> {
  const res = await fetch(apiUrl("/photos/import-path"), {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      path: opts.path,
      recursive: opts.recursive,
      tags: opts.tags,
      tag_rules: opts.tagRules,
      lowercase_tags: opts.lowercaseTags,
      dry_run: opts.dryRun,
    }),
  });
  return unwrap(res);
}

// Lists the executable downloader scripts the server is configured to run
// (see `downloaders_path` in config.toml). Empty if that's unset.
export async function listDownloaders(): Promise<DownloaderInfo[]> {
  const res = await fetch(apiUrl("/downloaders"), { headers: authHeaders() });
  return unwrap(res);
}

// Starts a downloader script as a background job on the server and returns
// its id immediately; poll getDownloaderJob to track progress.
export async function runDownloader(name: string, url: string): Promise<{ job_id: string }> {
  const res = await fetch(apiUrl(`/downloaders/${encodeURIComponent(name)}/run`), {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ url }),
  });
  return unwrap(res);
}

export async function getDownloaderJob(id: string): Promise<DownloaderJob> {
  const res = await fetch(apiUrl(`/downloaders/jobs/${encodeURIComponent(id)}`), { headers: authHeaders() });
  return unwrap(res);
}

export async function addTags(id: string, tags: string[]): Promise<Photo> {
  const res = await fetch(apiUrl(`/photos/${id}/tags`), {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ tags }),
  });
  return unwrap(res);
}

export async function removeTag(id: string, tag: string): Promise<Photo> {
  const res = await fetch(apiUrl(`/photos/${id}/tags`), {
    method: "DELETE",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ tags: [tag] }),
  });
  return unwrap(res);
}

export async function deletePhotoPermanently(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/photos/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
}

export async function bulkAddTags(photoIds: string[], tags: string[]): Promise<Photo[]> {
  const res = await fetch(apiUrl("/photos/tags"), {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ photo_ids: photoIds, tags }),
  });
  return unwrap(res);
}

export async function bulkRemoveTags(photoIds: string[], tags: string[]): Promise<Photo[]> {
  const res = await fetch(apiUrl("/photos/tags"), {
    method: "DELETE",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ photo_ids: photoIds, tags }),
  });
  return unwrap(res);
}

export async function bulkDeletePermanently(photoIds: string[]): Promise<void> {
  const res = await fetch(apiUrl("/photos/bulk-delete"), {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ photo_ids: photoIds }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
}

export async function regenerateThumbnail(id: string): Promise<Photo> {
  const res = await fetch(apiUrl(`/photos/${id}/regenerate-thumbnail`), {
    method: "POST",
    headers: authHeaders(),
  });
  return unwrap(res);
}

// phoserv requires a Bearer token on every request, including media, so <img>/<video>
// elements (which can't send custom headers) can't point at it directly. Fetch the
// bytes with auth and hand back a blob: URL instead.
export async function fetchMediaBlobUrl(path: string): Promise<string> {
  const res = await fetch(apiUrl(path), { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function thumbnailPath(id: string, size: "sm" | "md" = "sm"): string {
  return `/photos/${id}/thumbnail?size=${size}`;
}

export function filePath(id: string): string {
  return `/photos/${id}/file`;
}

export async function listGalleries(tag?: string): Promise<Gallery[]> {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  const qs = params.toString();
  const res = await fetch(`${apiUrl("/galleries")}${qs ? `?${qs}` : ""}`, { headers: authHeaders() });
  return unwrap(res);
}

export async function createGallery(title: string, description?: string): Promise<Gallery> {
  const res = await fetch(apiUrl("/galleries"), {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ title, description }),
  });
  return unwrap(res);
}

export async function getGallery(id: string): Promise<GalleryDetail> {
  const res = await fetch(apiUrl(`/galleries/${id}`), { headers: authHeaders() });
  return unwrap(res);
}

export async function updateGallery(
  id: string,
  patch: { title?: string; description?: string },
): Promise<Gallery> {
  const res = await fetch(apiUrl(`/galleries/${id}`), {
    method: "PATCH",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(patch),
  });
  return unwrap(res);
}

export async function deleteGallery(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/galleries/${id}`), { method: "DELETE", headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
}

export async function addPhotosToGallery(id: string, photoIds: string[]): Promise<GalleryDetail> {
  const res = await fetch(apiUrl(`/galleries/${id}/photos`), {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ photo_ids: photoIds }),
  });
  return unwrap(res);
}

export async function removePhotosFromGallery(id: string, photoIds: string[]): Promise<GalleryDetail> {
  const res = await fetch(apiUrl(`/galleries/${id}/photos`), {
    method: "DELETE",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ photo_ids: photoIds }),
  });
  return unwrap(res);
}

export async function reorderGallery(id: string, photoIds: string[]): Promise<GalleryDetail> {
  const res = await fetch(apiUrl(`/galleries/${id}/order`), {
    method: "PUT",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ photo_ids: photoIds }),
  });
  return unwrap(res);
}

export async function addGalleryTags(id: string, tags: string[]): Promise<Gallery> {
  const res = await fetch(apiUrl(`/galleries/${id}/tags`), {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ tags }),
  });
  return unwrap(res);
}

export async function removeGalleryTag(id: string, tag: string): Promise<Gallery> {
  const res = await fetch(apiUrl(`/galleries/${id}/tags`), {
    method: "DELETE",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ tags: [tag] }),
  });
  return unwrap(res);
}

export async function getGalleryTagTree(): Promise<TagNode[]> {
  const res = await fetch(apiUrl("/gallery-tags"), { headers: authHeaders() });
  return unwrap(res);
}

export async function renameGalleryTag(id: number, name: string): Promise<TagNode[]> {
  const res = await fetch(apiUrl(`/gallery-tags/${id}`), {
    method: "PATCH",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  return unwrap(res);
}

export async function deleteGalleryTag(id: number): Promise<TagNode[]> {
  const res = await fetch(apiUrl(`/gallery-tags/${id}`), { method: "DELETE", headers: authHeaders() });
  return unwrap(res);
}
