import type { ScanResult } from "../types";

export async function scanChannel(channelName: string): Promise<ScanResult> {
  const start = Date.now();
  const res = await fetch(`/api/scan?channel=${encodeURIComponent(channelName.trim().toLowerCase())}`);
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
