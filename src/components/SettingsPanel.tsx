"use client";

import { useState } from "react";
import { clearConfig, setConfig } from "@/lib/config";
import { useServerConfig } from "@/lib/useServerConfig";

export default function SettingsPanel() {
  const config = useServerConfig();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const form = new FormData(e.currentTarget);
    const rawUrl = String(form.get("url") ?? "");
    const rawToken = String(form.get("token") ?? "").trim();
    const finalToken = rawToken || config?.token;
    if (!finalToken) {
      setError("API token is required.");
      return;
    }

    try {
      setConfig(rawUrl, finalToken);
      setSaved(true);
    } catch {
      setError("Enter a valid URL, e.g. http://192.168.1.20:4173");
    }
  }

  function handleClear() {
    clearConfig();
    setSaved(false);
    setError(null);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Settings</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Point this app at your phoserv server. The URL and token are stored only in this
        browser (localStorage) and sent directly from your browser to phoserv — this app has
        no server-side component of its own.
      </p>
      <form key={config?.url ?? "unset"} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium mb-1">
            Server URL
          </label>
          <input
            id="url"
            name="url"
            type="text"
            defaultValue={config?.url ?? ""}
            placeholder="http://192.168.1.20:4173"
            className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="token" className="block text-sm font-medium mb-1">
            API token
          </label>
          <input
            id="token"
            name="token"
            type="password"
            placeholder={config ? "•••••••• (leave blank to keep current token)" : "paste your api_token here"}
            className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-neutral-500">
            {config ? "A token is currently saved in this browser." : "No token saved yet."}
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Saved.</p>}
        <button type="submit" className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white">
          Save
        </button>
      </form>
      <button type="button" onClick={handleClear} className="mt-4 text-sm text-red-600">
        Clear saved config
      </button>
    </div>
  );
}
