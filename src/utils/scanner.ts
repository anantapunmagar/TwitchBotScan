import type { ScanResult } from "../types";

export async function scanChannel(channelName: string): Promise<ScanResult> {
  const start = Date.now();

  let res: Response;
  try {
    res = await fetch(`/api/scan?channel=${encodeURIComponent(channelName.trim().toLowerCase())}`);
  } catch (networkErr) {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  // Vercel may return an HTML error page on a hard function crash — guard against that
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Server error (${res.status}). Check Vercel function logs for details.`);
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Scan failed (${res.status})`);
  }

  return {
    ...data,
    timestamp: new Date(data.timestamp),
    scanDuration: Date.now() - start,
  };
}
