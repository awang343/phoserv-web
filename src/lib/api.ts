import type { Photo, PhotoListResponse, TagNode } from "./types";

const BASE = "/api/phoserv";

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function listPhotos(opts: {
  tag?: string;
  limit?: number;
  offset?: number;
}): Promise<PhotoListResponse> {
  const params = new URLSearchParams();
  if (opts.tag) params.set("tag", opts.tag);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));
  const res = await fetch(`${BASE}/photos?${params.toString()}`);
  return unwrap(res);
}

export async function getPhoto(id: string): Promise<Photo> {
  const res = await fetch(`${BASE}/photos/${id}`);
  return unwrap(res);
}

export async function getTagTree(): Promise<TagNode[]> {
  const res = await fetch(`${BASE}/tags`);
  return unwrap(res);
}

export async function uploadPhoto(file: File, tags: string[]): Promise<Photo> {
  const form = new FormData();
  form.append("file", file);
  for (const tag of tags) {
    if (tag.trim()) form.append("tags", tag.trim());
  }
  const res = await fetch(`${BASE}/photos`, { method: "POST", body: form });
  return unwrap(res);
}

export async function addTags(id: string, tags: string[]): Promise<Photo> {
  const res = await fetch(`${BASE}/photos/${id}/tags`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tags }),
  });
  return unwrap(res);
}

export async function removeTag(id: string, tag: string): Promise<Photo> {
  const res = await fetch(`${BASE}/photos/${id}/tags`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tags: [tag] }),
  });
  return unwrap(res);
}

export function thumbnailUrl(id: string, size: "sm" | "md" = "sm"): string {
  return `${BASE}/photos/${id}/thumbnail?size=${size}`;
}

export function fileUrl(id: string): string {
  return `${BASE}/photos/${id}/file`;
}
