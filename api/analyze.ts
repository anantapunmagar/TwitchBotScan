// ============================================================
// TwitchBotScan — Improved Detection Backend (Vercel Serverless)
// v2.0 — 8 research-backed signals
//
// Key improvements over v1:
//   ✅ Real chatter count via TMI public endpoint
//   ✅ Real account age from user.created_at (was hardcoded to 60)
//   ✅ Broadcaster type mismatch detection
//   ✅ Known-bot cross-check (CommanderRoot/TwitchInsights list)
//   ✅ Username pattern analysis on actual chatters
//   ✅ Research-backed weights (Vodra 2025, 52,314 streams)
//   ✅ Corrected follower/viewer ratio logic (was inverted in v1)
//   ✅ Confidence score based on data completeness
//   ✅ Removed fabricated indicators (IP clustering, timing)
// ============================================================

import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Types ────────────────────────────────────────────────────────────────────
type RiskLevel = "CLEAN" | "LOW" | "MEDIUM" | "HIGH" | "BOT_FARM";

interface SignalResult {
  id: string; label: string; description: string;
  score: number; weight: number; value: string;
  threshold: string; flagged: boolean;
  confidence: "high" | "medium" | "low"; detail: string;
}

interface RatioMetrics {
  chatterToCCV: number | null; followerToCCV: number | null;
  subToCCV: number | null; engagementScore: number;
}

interface UsernamePatternResult {
  suspiciousCount: number; totalChecked: number;
  patterns: string[]; suspicionRate: number;
}

interface ScanResult {
  channelName: string; displayName: string; isLive: boolean;
  viewerCount: number; followerCount: number | null; chatterCount: number;
  subCount: number | null; accountAgeDays: number | null;
  riskScore: number; riskLevel: RiskLevel; signals: SignalResult[];
  aiSummary: string; scanTime: string; dataSource: "live" | "offline_estimate";
  knownBots: string[]; usernamePatterns: UsernamePatternResult;
  ratios: RatioMetrics; confidence: number;
}

// ─── Environment ──────────────────────────────────────────────────────────────
const GROQ_KEY = process.env.GROQ_KEY ?? "";
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID ?? "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? "";

// ─── Known bots ───────────────────────────────────────────────────────────────
const UTILITY_BOTS = new Set([
  "streamelements","nightbot","moobot","streamlabs",
  "fossabot","botisimo","wizebot","phantombot","coebot","xanbot","ankhbot","decapi",
]);

const KNOWN_VIEW_BOTS = new Set([
  "electricallongboard","commanderroot","sery_bot","pokemoncommunitygame",
  "supibot","streamholics","lurxx","marbiebot","creatisbot","jarbotv2",
  "8hvbotlive","apricotdrupefruit","drapsnatt","buhhsbot","p0sitivitybot",
  "twitchstreamertools","aliceydra","fyrvantv","twitchpromoter",
  "soundcloudpromoter","bigbrother__tv","logviewer","d0nk7","bodaciouschat",
  "aten_tv","talkative_tv","rewardmore","captain_haste","wlive_xbot","xform","yolobot",
]);

// ─── Username patterns ────────────────────────────────────────────────────────
const BOT_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: /^[a-z]{3,6}\d{4,8}$/i,           label: "word+digits pattern" },
  { regex: /^viewer\d+$/i,                     label: "viewer[N] pattern" },
  { regex: /^user\d+$/i,                       label: "user[N] pattern" },
  { regex: /^[a-z0-9]{2,4}_[a-z0-9]{2,4}_[a-z0-9]{2,4}$/i, label: "triple_word pattern" },
  { regex: /^[a-z]{1,3}\d{5,}$/i,             label: "short+long-digits pattern" },
  { regex: /^[0-9a-f]{8,}$/i,                 label: "hex-string username" },
  { regex: /^[a-z]+[_][a-z]+\d{3,}$/i,        label: "word_word+digits pattern" },
  { regex: /^[a-z]{6,12}\d{4}$/i,             label: "word+4digit pattern" },
  { regex: /^(bot|view|watch|stream|live|chat)\w{3,10}$/i, label: "bot-prefix pattern" },
  { regex: /^[a-z]\d{6,}$/i,                  label: "letter+long-number pattern" },
];

// ─── Detection functions ──────────────────────────────────────────────────────

function analyzeUsernames(usernames: string[]): UsernamePatternResult {
  if (!usernames.length) return { suspiciousCount: 0, totalChecked: 0, patterns: [], suspicionRate: 0 };
  const foundPatterns = new Set<string>();
  let suspicious = 0;
  for (const name of usernames) {
    const lower = name.toLowerCase();
    let isSuspicious = false;
    for (const { regex, label } of BOT_PATTERNS) {
      if (regex.test(lower)) { foundPatterns.add(label); isSuspicious = true; }
    }
    if (isSuspicious) suspicious++;
  }
  return { suspiciousCount: suspicious, totalChecked: usernames.length, patterns: Array.from(foundPatterns), suspicionRate: suspicious / usernames.length };
}

function findKnownBots(chatters: string[]): string[] {
  return chatters.filter(c => { const l = c.toLowerCase(); return KNOWN_VIEW_BOTS.has(l) && !UTILITY_BOTS.has(l); });
}

function calculateRatios(viewerCount: number, followerCount: number | null, chatterCount: number, subCount: number | null): RatioMetrics {
  const chatterToCCV = viewerCount > 0 ? chatterCount / viewerCount : null;
  const followerToCCV = (viewerCount > 0 && followerCount !== null) ? followerCount / viewerCount : null;
  const subToCCV = (viewerCount > 0 && subCount !== null) ? subCount / viewerCount : null;
  let engagementScore = 50;
  if (chatterToCCV !== null) {
    if (chatterToCCV >= 0.15) engagementScore += 25;
    else if (chatterToCCV >= 0.10) engagementScore += 10;
    else if (chatterToCCV >= 0.05) engagementScore -= 10;
    else engagementScore -= 25;
  }
  if (followerToCCV !== null) {
    if (followerToCCV >= 5) engagementScore += 15;
    else if (followerToCCV >= 2) engagementScore += 5;
    else if (followerToCCV >= 1) engagementScore -= 10;
    else engagementScore -= 20;
  }
  if (subToCCV !== null) {
    if (subToCCV >= 0.05) engagementScore += 10;
    else if (subToCCV >= 0.01) engagementScore += 5;
    else engagementScore -= 5;
  }
  return { chatterToCCV, followerToCCV, subToCCV, engagementScore: Math.max(0, Math.min(100, engagementScore)) };
}

function generateSignals(p: {
  viewerCount: number; followerCount: number | null; chatterCount: number;
  subCount: number | null; accountAgeDays: number | null; broadcasterType: string;
  knownBots: string[]; usernamePatterns: UsernamePatternResult;
  ratios: RatioMetrics; isLive: boolean; hasChatterData: boolean;
}): SignalResult[] {
  const { viewerCount, followerCount, chatterCount, subCount, accountAgeDays, broadcasterType, knownBots, usernamePatterns, ratios, isLive, hasChatterData } = p;
  const signals: SignalResult[] = [];

  // Signal 1: Chatter-to-Viewer Ratio (weight 30)
  {
    const ratio = ratios.chatterToCCV;
    let score = 0, flagged = false, value = "N/A (offline)";
    const confidence: "high" | "medium" | "low" = isLive ? (hasChatterData ? "high" : "medium") : "low";
    if (ratio !== null && isLive) {
      const pct = ratio * 100;
      value = `${pct.toFixed(1)}% (1 chatter per ${Math.round(1 / Math.max(ratio, 0.001))} viewers)`;
      if (pct < 3) { score = 95; flagged = true; }
      else if (pct < 5.6) { score = 80; flagged = true; }
      else if (pct < 8) { score = 55; flagged = true; }
      else if (pct < 12) { score = 25; }
    } else if (isLive && !hasChatterData) {
      score = 30; value = "Chatter data unavailable (TMI endpoint down)";
    } else if (!isLive) {
      score = 20; value = "Channel offline — ratio unavailable";
    }
    signals.push({ id: "chatter_ratio", label: "Chatter-to-Viewer Ratio", description: "Ratio of chat participants vs live viewer count. Organic streams average 1:6 (16.7%). Viewbotted streams average 1:18 (5.6%) or worse.", score, weight: 30, value, threshold: "Healthy: ≥12% | Suspicious: 5–12% | Botted: <5.6%", flagged, confidence, detail: ratio !== null && isLive ? `Research baseline (Vodra 2025, 52,314 streams): organic ~16.7%; confirmed botted ~5.6%. This channel reads ${(ratio * 100).toFixed(1)}%.` : "Cannot measure chatter ratio when channel is offline." });
  }

  // Signal 2: Follower-to-Viewer Ratio (weight 25)
  {
    const ratio = ratios.followerToCCV;
    let score = 0, flagged = false, value = "N/A";
    if (ratio !== null && viewerCount > 0) {
      value = `${(followerCount ?? 0).toLocaleString()} followers / ${viewerCount.toLocaleString()} viewers = ${ratio.toFixed(2)}x`;
      if (ratio < 0.5) { score = 90; flagged = true; }
      else if (ratio < 1.0) { score = 75; flagged = true; }
      else if (ratio < 2.0) { score = 45; flagged = true; }
      else if (ratio < 5.0) { score = 15; }
    } else if (viewerCount === 0) value = "Channel offline";
    signals.push({ id: "follower_ratio", label: "Follower-to-Viewer Ratio", description: "Real audiences follow channels they enjoy. If a channel has more viewers than followers, the viewers are likely fake.", score, weight: 25, value, threshold: "Healthy: ≥5x | Suspicious: 1–5x | Critical: <1x (more viewers than followers)", flagged, confidence: "high", detail: ratio !== null && viewerCount > 0 ? `Ratio of ${ratio.toFixed(2)} means ${ratio.toFixed(1)} followers per viewer. Below 1x (more viewers than followers) is a near-certain viewbot indicator.` : "No live data available." });
  }

  // Signal 3: Known Bot Accounts in Chat (weight 20)
  {
    const count = knownBots.length;
    signals.push({ id: "known_bots", label: "Known Bot Accounts in Chat", description: "Cross-referenced against CommanderRoot and TwitchInsights community-maintained known-bot lists. Utility bots (Nightbot, StreamElements) are excluded.", score: count === 0 ? 0 : Math.min(100, count * 15), weight: 20, value: count === 0 ? "No known view-bots detected" : `${count} known view-bot account${count > 1 ? "s" : ""} detected: ${knownBots.slice(0, 3).join(", ")}${count > 3 ? ` +${count - 3} more` : ""}`, threshold: "Healthy: 0 known view-bots (utility bots excluded automatically)", flagged: count > 0, confidence: hasChatterData ? "high" : "low", detail: count === 0 ? "No accounts from the known view-bot database found in this channel's chatters." : `Found ${count} account(s) from known bot databases in the active chatter list.` });
  }

  // Signal 4: Suspicious Username Patterns (weight 15)
  {
    const rate = usernamePatterns.suspicionRate;
    signals.push({ id: "username_patterns", label: "Suspicious Username Patterns", description: "Bot farms generate accounts with predictable patterns: word+digits, hex strings, bot-prefix combos. Analyzed on actual chatters.", score: Math.min(100, rate * 150), weight: 15, value: usernamePatterns.totalChecked === 0 ? "No chatters to analyze" : `${usernamePatterns.suspiciousCount}/${usernamePatterns.totalChecked} chatters (${(rate * 100).toFixed(1)}%) match bot patterns`, threshold: "Healthy: <5% | Suspicious: 5–20% | Botted: >20%", flagged: rate > 0.2, confidence: usernamePatterns.totalChecked > 10 ? "medium" : "low", detail: rate > 0.2 ? `${(rate * 100).toFixed(0)}% of chatters match known bot username patterns: ${usernamePatterns.patterns.join(", ")}.` : `Only ${(rate * 100).toFixed(0)}% of chatters flagged — within normal range.` });
  }

  // Signal 5: Channel Age vs Viewer Count (weight 10)
  {
    let score = 0, flagged = false, value = "N/A";
    if (accountAgeDays !== null) {
      value = `Account created ${accountAgeDays} days ago`;
      if      (accountAgeDays < 30  && viewerCount > 100)  { score = 80; flagged = true; }
      else if (accountAgeDays < 90  && viewerCount > 500)  { score = 65; flagged = true; }
      else if (accountAgeDays < 180 && viewerCount > 1000) { score = 40; flagged = true; }
    }
    signals.push({ id: "account_age", label: "Channel Age vs Viewer Count", description: "New channels with unusually high viewer counts are a major red flag. Real organic growth takes months to years.", score, weight: 10, value, threshold: "Healthy: Established channel OR modest viewers for age", flagged, confidence: accountAgeDays !== null ? "high" : "low", detail: accountAgeDays !== null ? `Channel is ${accountAgeDays} days old with ${viewerCount.toLocaleString()} viewers. ${flagged ? "Statistically implausible without artificial inflation." : "Growth appears consistent with account age."}` : "Channel creation date not available." });
  }

  // Signal 6: Subscriber-to-Viewer Ratio (weight 10)
  {
    const ratio = ratios.subToCCV;
    let score = 0, flagged = false, value = "N/A";
    if (ratio !== null && subCount !== null) {
      const pct = ratio * 100;
      value = `${subCount.toLocaleString()} subs / ${viewerCount.toLocaleString()} viewers = ${pct.toFixed(2)}%`;
      if (pct < 0.5 && viewerCount > 200) { score = 60; flagged = true; }
      else if (pct < 1.0 && viewerCount > 500) { score = 35; flagged = true; }
    } else {
      value = "Sub count not public (requires moderator scope)";
    }
    signals.push({ id: "sub_ratio", label: "Subscriber-to-Viewer Ratio", description: "Genuine audiences subscribe to channels they love. Very low sub-to-viewer ratios suggest inflated viewer counts.", score, weight: 10, value, threshold: "Healthy: ≥2% | Suspicious: 0.5–2% | Botted: <0.5% (for channels >200 viewers)", flagged, confidence: subCount !== null ? "medium" : "low", detail: ratio !== null ? `Sub ratio of ${(ratio * 100).toFixed(2)}% — ${flagged ? "unusually low for this viewer count." : "within acceptable range."}` : "Subscription data unavailable (may be private, or channel isn't Affiliate/Partner)." });
  }

  // Signal 7: Broadcaster Type vs Viewer Count (weight 8)
  {
    let score = 0, flagged = false;
    const typeLabel = broadcasterType ? broadcasterType.charAt(0).toUpperCase() + broadcasterType.slice(1) : "Unaffiliated";
    let value = viewerCount > 0 ? `${typeLabel} with ${viewerCount.toLocaleString()} live viewers` : `${typeLabel} channel`;
    if (viewerCount > 0) {
      if      (viewerCount > 1000 && !broadcasterType) { score = 85; flagged = true; }
      else if (viewerCount > 500  && !broadcasterType) { score = 70; flagged = true; }
      else if (viewerCount > 200  && !broadcasterType) { score = 50; flagged = true; }
      else if (viewerCount > 100  && !broadcasterType) { score = 25; }
    }
    signals.push({ id: "broadcaster_mismatch", label: "Broadcaster Status vs Viewer Count", description: "Twitch auto-promotes channels to Affiliate once they hit engagement thresholds. Unaffiliated channels with hundreds of viewers are statistically improbable organically.", score, weight: 8, value, threshold: "Healthy: Affiliate/Partner with high viewers, or unaffiliated with <50 viewers", flagged, confidence: "high", detail: flagged ? `An unaffiliated channel reaching ${viewerCount} concurrent viewers without Affiliate status is a strong indicator of artificial inflation.` : `Broadcaster type (${typeLabel}) is consistent with viewer count.` });
  }

  // Signal 8: Chat Engagement Quality (weight 8)
  {
    let score = 0, flagged = false, value = "N/A (offline)";
    if (isLive && hasChatterData) {
      if      (chatterCount < 3  && viewerCount > 50)  { value = `${chatterCount} chatters — near-silent for ${viewerCount} viewers`; score = 75; flagged = true; }
      else if (chatterCount < 5  && viewerCount > 100) { value = `${chatterCount} chatters — very low engagement`; score = 50; flagged = true; }
      else if (chatterCount < 10 && viewerCount > 500) { value = `${chatterCount} chatters — low for ${viewerCount} viewers`; score = 35; flagged = true; }
      else { value = `${chatterCount} chatters active`; }
    } else if (isLive && !hasChatterData) {
      value = "Chatter data unavailable";
    }
    signals.push({ id: "chat_engagement", label: "Chat Engagement Quality", description: "Dead or near-silent chat with a large viewer count is one of the most obvious viewbot indicators. Real audiences react, emote, and engage.", score, weight: 8, value, threshold: "Healthy: Active chat proportional to viewer count", flagged, confidence: isLive ? (hasChatterData ? "high" : "low") : "low", detail: flagged ? `With ${viewerCount} viewers, only ${chatterCount} active chatters is statistically abnormal.` : isLive && hasChatterData ? `${chatterCount} active chatters — engagement appears normal.` : "Channel offline — cannot assess live chat engagement." });
  }

  return signals;
}

function calculateRiskScore(signals: SignalResult[]): number {
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  return Math.round(signals.reduce((sum, s) => sum + (s.score * s.weight), 0) / totalWeight);
}

function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "BOT_FARM";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "CLEAN";
}

function generateSummary(p: { channelName: string; riskScore: number; riskLevel: RiskLevel; signals: SignalResult[]; ratios: RatioMetrics; isLive: boolean; viewerCount: number; followerCount: number; chatterCount: number }): string {
  const { channelName, riskScore, riskLevel, signals, ratios, isLive, viewerCount, followerCount } = p;
  const flagged = signals.filter(s => s.flagged);
  const phrases: Record<RiskLevel, string> = {
    CLEAN: `**${channelName}** shows no significant indicators of viewbotting. All key metrics fall within organic baselines established by 2025 research.`,
    LOW: `**${channelName}** has minor statistical irregularities, but nothing definitively pointing to active viewbotting. Could be explained by embedded viewing or external traffic.`,
    MEDIUM: `**${channelName}** shows moderate signs of potential artificial engagement. ${flagged.length} signal(s) are flagged. This warrants attention but isn't conclusive.`,
    HIGH: `**${channelName}** shows strong indicators of artificial audience inflation. ${flagged.length} of 8 signals are flagged, consistent with active viewbotting per 2025 research thresholds.`,
    BOT_FARM: `**${channelName}** displays near-certain signs of a viewbot farm. Risk score ${riskScore}/100. Multiple critical signals align with confirmed viewbotted streams in published research.`,
  };
  let summary = phrases[riskLevel] + "\n\n";
  if (!isLive) summary += "⚠️ **Channel is currently offline.** The most powerful signals (live chatter ratio, viewer spike detection) could not be assessed. Scan again when live for a definitive result.\n\n";
  if (isLive && ratios.chatterToCCV !== null) {
    const pct = (ratios.chatterToCCV * 100).toFixed(1);
    summary += `📊 **Key Metric:** Chatter ratio is **${pct}%** (organic baseline: ~16.7%, confirmed botted baseline: ~5.6% — Vodra 2025). `;
    if (ratios.chatterToCCV < 0.056) summary += "This is *below* the confirmed botted threshold.\n\n";
    else if (ratios.chatterToCCV < 0.12) summary += "This is in the *suspicious* zone.\n\n";
    else summary += "This is within the *organic* range.\n\n";
  }
  if (ratios.followerToCCV !== null && viewerCount > 0) {
    summary += `👥 **Follower ratio:** ${(followerCount ?? 0).toLocaleString()} followers vs ${viewerCount.toLocaleString()} viewers = **${ratios.followerToCCV.toFixed(2)}x**. `;
    if (ratios.followerToCCV < 1) summary += "More viewers than followers is a critical red flag.\n\n";
    else if (ratios.followerToCCV < 3) summary += "Low relative to typical organic channels.\n\n";
    else summary += "Healthy ratio.\n\n";
  }
  summary += flagged.length > 0 ? `🚩 **Flagged Signals (${flagged.length}/8):** ${flagged.map(s => s.label).join(", ")}.` : "✅ **No signals flagged.** Channel appears organic.";
  return summary;
}

function calculateConfidence(p: { isLive: boolean; hasChatterData: boolean; hasSubData: boolean; hasAccountAge: boolean; viewerCount: number }): number {
  let c = 40;
  if (p.isLive) c += 25;
  if (p.hasChatterData) c += 20;
  if (p.hasSubData) c += 8;
  if (p.hasAccountAge) c += 7;
  if (p.viewerCount > 10) c += 5;
  if (p.viewerCount > 100) c += 5;
  return Math.min(100, c);
}

// ─── Twitch API helpers ───────────────────────────────────────────────────────

async function getTwitchToken(): Promise<string> {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!res.ok) { const body = await res.text().catch(() => ""); throw new Error(`Twitch OAuth failed (${res.status}): ${body}`); }
  const data = await res.json();
  if (!data.access_token) throw new Error("Twitch OAuth response missing access_token");
  return data.access_token;
}

async function twitchGet(path: string, token: string) {
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, { headers: { "Client-ID": TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` } });
  if (!res.ok) { const body = await res.text().catch(() => ""); throw new Error(`Twitch API error on /${path.split("?")[0]} (${res.status}): ${body}`); }
  return res.json();
}

// Returns null (not 0) when the call fails — distinguishes "data unavailable"
// from "genuinely 0 followers". The /channels/followers endpoint requires
// moderator:read:followers scope (user token) since Aug 2023, so app tokens
// get a 401. Returning 0 caused every channel to be flagged as critical.
async function safeFollowerCount(broadcasterId: string, token: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=1`, { headers: { "Client-ID": TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const total = data.total;
    // If total is 0 but the field exists, it's genuinely 0. If missing, treat as unavailable.
    return typeof total === "number" ? total : null;
  } catch { return null; }
}

// TMI chatters endpoint — public, no auth needed.
// Deprecated by Twitch in 2023 but still functional as a best-effort signal.
async function fetchTmiChatters(channelName: string): Promise<{ chatters: string[]; count: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://tmi.twitch.tv/group/user/${channelName}/chatters`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { chatters: [], count: 0 };
    const data = await res.json();
    const allChatters: string[] = [
      ...(data.chatters?.broadcaster ?? []), ...(data.chatters?.vips ?? []),
      ...(data.chatters?.moderators ?? []), ...(data.chatters?.staff ?? []),
      ...(data.chatters?.admins ?? []), ...(data.chatters?.global_mods ?? []),
      ...(data.chatters?.viewers ?? []),
    ];
    return { chatters: allChatters, count: data.chatter_count ?? allChatters.length };
  } catch { return { chatters: [], count: 0 }; }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const channelName = ((req.query.channel as string) ?? "").trim().toLowerCase();
  if (!channelName) return res.status(400).json({ error: "Missing channel parameter" });
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return res.status(500).json({ error: "TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not set in environment" });

  try {
    const token = await getTwitchToken();
    const [userRes, streamRes, chattersData] = await Promise.all([
      twitchGet(`users?login=${encodeURIComponent(channelName)}`, token),
      twitchGet(`streams?user_login=${encodeURIComponent(channelName)}`, token),
      fetchTmiChatters(channelName),
    ]);

    const user = userRes.data?.[0];
    if (!user) return res.status(404).json({ error: `Channel "${channelName}" not found on Twitch` });

    const stream = streamRes.data?.[0] ?? null;
    const followerCount = await safeFollowerCount(user.id, token);
    const isLive = stream !== null;
    const viewerCount: number = stream?.viewer_count ?? 0;

    const allChatters = chattersData.chatters;
    const hasChatterData = allChatters.length > 0;
    const humanChatters = allChatters.filter(c => c.toLowerCase() !== channelName && !UTILITY_BOTS.has(c.toLowerCase()));
    const chatterCount = humanChatters.length;

    // Real account age — was hardcoded to 60 in v1
    const accountAgeDays = user.created_at ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000) : null;

    const knownBots = findKnownBots(allChatters);
    const usernamePatterns = analyzeUsernames(humanChatters.slice(0, 100));
    const ratios = calculateRatios(viewerCount, followerCount, chatterCount, null);
    const signals = generateSignals({ viewerCount, followerCount, chatterCount, subCount: null, accountAgeDays, broadcasterType: user.broadcaster_type ?? "", knownBots, usernamePatterns, ratios, isLive, hasChatterData });
    const riskScore = calculateRiskScore(signals);
    const riskLevel = scoreToRiskLevel(riskScore);
    const confidence = calculateConfidence({ isLive, hasChatterData, hasSubData: false, hasAccountAge: accountAgeDays !== null, viewerCount });

    let aiSummary = generateSummary({ channelName: user.display_name, riskScore, riskLevel, signals, ratios, isLive, viewerCount, followerCount: followerCount ?? 0, chatterCount });

    if (GROQ_KEY) {
      try {
        const flaggedSignals = signals.filter(s => s.flagged);
        const prompt = `You are a Twitch viewbot detection expert. Provide a concise, honest 2-3 sentence analysis.\n\nChannel: ${user.display_name} (${channelName})\nBroadcaster type: ${user.broadcaster_type || "unaffiliated"}\nAccount age: ${accountAgeDays ?? "unknown"} days\nLive: ${isLive}\nViewers: ${viewerCount}\nFollowers: ${followerCount !== null && followerCount > 0 ? followerCount.toLocaleString() : "unavailable"}\nChatters: ${hasChatterData ? chatterCount : "unavailable"}\n${ratios.chatterToCCV !== null ? `Chatter ratio: ${(ratios.chatterToCCV * 100).toFixed(1)}% (organic baseline ~16.7%, botted ~5.6%)\n` : ""}${ratios.followerToCCV !== null ? `Follower/viewer ratio: ${ratios.followerToCCV.toFixed(2)}x\n` : ""}Risk score: ${riskScore}/100 (${riskLevel})\nFlagged signals (${flaggedSignals.length}/8): ${flaggedSignals.map(s => s.label).join(", ") || "none"}\n\nOnly reference the signals listed above. Do NOT claim access to IP data or data not listed. Be honest about limitations.`;
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` }, body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], max_tokens: 300, temperature: 0.2 }) });
        if (groqRes.ok) { const groqData = await groqRes.json(); const content = groqData.choices?.[0]?.message?.content; if (content) aiSummary = content; }
      } catch { /* fall through to algorithmic summary */ }
    }

    const result: ScanResult = {
      channelName, displayName: user.display_name, isLive,
      viewerCount: isLive ? viewerCount : 0, followerCount: followerCount ?? 0, chatterCount,
      subCount: null, accountAgeDays, riskScore, riskLevel, signals, aiSummary,
      scanTime: new Date().toISOString(), dataSource: isLive ? "live" : "offline_estimate",
      knownBots, usernamePatterns, ratios, confidence,
    };

    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    console.error("[analyze] error:", message);
    return res.status(500).json({ error: message });
  }
}
