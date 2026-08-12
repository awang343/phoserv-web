import type { Photo, PhotoListResponse, TagNode } from "./types";
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
  tag?: string;
  limit?: number;
  cursor?: string;
  trash?: boolean;
}): Promise<PhotoListResponse> {
  const params = new URLSearchParams();
  if (opts.tag) params.set("tag", opts.tag);
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
