export interface Photo {
  id: string;
  hash: string;
  original_filename: string;
  mime_type: string;
  media_type: "image" | "video";
  file_size: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  taken_at: string | null;
  created_at: string;
  tags: string[];
}

export interface PhotoListResponse {
  photos: Photo[];
  total: number;
  limit: number;
  next_cursor: string | null;
}

export interface TagNode {
  id: number;
  name: string;
  path: string;
  count: number;
  children: TagNode[];
}

export interface Gallery {
  id: string;
  title: string;
  description: string | null;
  cover_photo_id: string | null;
  photo_count: number;
  tags: string[];
  created_at: string;
}

export interface GalleryDetail {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  created_at: string;
  photos: Photo[];
}

export interface ImportTagRule {
  pattern: string;
  template: string;
}

export interface ImportFileResult {
  path: string;
  status: "uploaded" | "tagged" | "skipped" | "error" | "dry_run";
  tags: string[];
  photo_id: string | null;
  error: string | null;
}

export interface ImportSummary {
  scanned: number;
  uploaded: number;
  tagged: number;
  skipped: number;
  errors: number;
}

export interface ImportPathResponse {
  results: ImportFileResult[];
  summary: ImportSummary;
}

export interface DownloaderInfo {
  name: string;
}

export type DownloaderJobStatus = "running" | "completed" | "failed";

export interface DownloaderJob {
  id: string;
  script: string;
  urls: string[];
  // Index into `urls` of the one currently being processed; null once every
  // url has been run.
  current_index: number | null;
  status: DownloaderJobStatus;
  log: string[];
  results: ImportFileResult[];
  summary: ImportSummary;
  started_at: string;
  finished_at: string | null;
}
