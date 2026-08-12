"use client";

import { useSyncExternalStore } from "react";
import {
  getConfigServerSnapshot,
  getConfigSnapshot,
  parseConfigSnapshot,
  subscribeConfig,
  type ServerConfig,
} from "./config";

export function useServerConfig(): ServerConfig | null {
  const snapshot = useSyncExternalStore(subscribeConfig, getConfigSnapshot, getConfigServerSnapshot);
  return parseConfigSnapshot(snapshot);
}
