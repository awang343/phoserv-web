"use client";

import { useEffect, useState } from "react";
import { fetchMediaBlobUrl } from "./api";

export function useAuthMedia(path: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let active = true;
    let objectUrl: string | null = null;
    fetchMediaBlobUrl(path)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return src;
}
