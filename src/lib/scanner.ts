// ─── Scanner: calls Vercel API backend ───────────────────────────────────────
import type { ScanResult } from "./botDetection";

export async function scanChannel(channelName: string): Promise<ScanResult> {
  const name = channelName.trim().toLowerCase().replace(/^@/, "");
  if (!name) throw new Error("Channel name is required.");

  let res: Response;
  try {
    res = await fetch(`/api/analyze?channel=${encodeURIComponent(name)}`);
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Server error (${res.status}). Check Vercel function logs for details.`);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Scan failed (${res.status})`);
  }

  return data as ScanResult;
}
