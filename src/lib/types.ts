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
  offset: number;
}

export interface TagNode {
  id: number;
  name: string;
  path: string;
  children: TagNode[];
}
