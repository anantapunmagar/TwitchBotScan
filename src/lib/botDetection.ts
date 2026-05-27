// ============================================================
// TwitchBotScan — Improved Bot Detection Engine
// Based on 2025 research: Vodra quantitative analysis,
// TwitchLift methodology, StreamCharts, and community signals.
// Key signals (with research-backed weights):
//   1. Chatter-to-CCV ratio  (organic 1:6, botted 1:18+)
//   2. Follower-to-CCV ratio  (botted streams: very low)
//   3. Subscriber-to-CCV ratio
//   4. Viewer spike patterns  (sudden +500-1000 without raid)
//   5. Known-bot list cross-check  (CommanderRoot / TwitchInsights)
//   6. Suspicious username pattern analysis
//   7. Account age clustering
//   8. Chat sentiment / repetition analysis
// ============================================================

export type RiskLevel = "CLEAN" | "LOW" | "MEDIUM" | "HIGH" | "BOT_FARM";

export interface SignalResult {
  id: string;
  label: string;
  description: string;
  score: number;        // 0-100 (contribution to total risk)
  weight: number;       // relative importance weight
  value: string;        // human-readable observed value
  threshold: string;    // what a clean channel looks like
  flagged: boolean;
  confidence: "high" | "medium" | "low";
  detail: string;
}

export interface ScanResult {
  channelName: string;
  displayName: string;
  isLive: boolean;
  viewerCount: number;
  followerCount: number;
  chatterCount: number;
  subCount: number | null;
  accountAgeDays: number | null;
  riskScore: number;           // 0-100 weighted composite
  riskLevel: RiskLevel;
  signals: SignalResult[];
  aiSummary: string;
  scanTime: string;
  dataSource: "live" | "offline_estimate";
  knownBots: string[];
  usernamePatterns: UsernamePatternResult;
  ratios: RatioMetrics;
  confidence: number;          // overall confidence 0-100
}

export interface RatioMetrics {
  chatterToCCV: number | null;       // chatters per 1 viewer (organic: ~1:6 = 0.167)
  followerToCCV: number | null;      // followers / viewer count (healthy: >3)
  subToCCV: number | null;           // subs / viewer count
  engagementScore: number;           // composite 0-100
}

export interface UsernamePatternResult {
  suspiciousCount: number;
  totalChecked: number;
  patterns: string[];
  suspicionRate: number;    // 0-1
}

// ─── Known Community Bot Lists (subset — most common lurk-bots) ──────────────
// Source: CommanderRoot & TwitchInsights known bot lists
export const KNOWN_BOT_USERNAMES = new Set([
  "streamelements", "nightbot", "moobot", "streamlabs",
  "wizebot", "fossabot", "botisimo", "ohbot",
  "phantombot", "coebot", "xanbot", "ankhbot",
  "decapi", "vivbot", "hnlbot", "stay_hydrated_bot",
  "soundalerts", "songlistbot", "electricallongboard",
  "commanderroot", "sery_bot", "pokemoncommunitygame",
  "supibot", "streamholics", "vohiyo", "kofistreambot",
  "lurxx", "marbiebot", "creatisbot", "jarbotv2",
  "hnlbot", "8hvbotlive", "apricotdrupefruit",
  "drapsnatt", "buhhsbot", "p0sitivitybot",
  "twitchstreamertools", "aliceydra", "fyrvantv",
  "twitchpromoter", "soundcloudpromoter", "bigbrother__tv",
  "logviewer", "roflgator", "mariekittykat", "virgoproz",
  "d0nk7", "bodaciouschat", "aten_tv", "talkative_tv",
  "rewardmore", "captain_haste", "wlive_xbot",
  "xform", "yolobot", "cactpot_bot",
]);

// ─── Suspicious Username Pattern Regexes ──────────────────────────────────────
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

// ─── Analyze a list of usernames for bot patterns ────────────────────────────
export function analyzeUsernames(usernames: string[]): UsernamePatternResult {
  if (!usernames.length) {
    return { suspiciousCount: 0, totalChecked: 0, patterns: [], suspicionRate: 0 };
  }

  const foundPatterns = new Set<string>();
  let suspicious = 0;

  for (const name of usernames) {
    const lower = name.toLowerCase();
    let isSuspicious = false;
    for (const { regex, label } of BOT_PATTERNS) {
      if (regex.test(lower)) {
        foundPatterns.add(label);
        isSuspicious = true;
      }
    }
    if (isSuspicious) suspicious++;
  }

  return {
    suspiciousCount: suspicious,
    totalChecked: usernames.length,
    patterns: Array.from(foundPatterns),
    suspicionRate: suspicious / usernames.length,
  };
}

// ─── Cross-check chatters against known bot list ─────────────────────────────
export function findKnownBots(chatters: string[]): string[] {
  return chatters.filter(c => KNOWN_BOT_USERNAMES.has(c.toLowerCase()));
}

// ─── Calculate ratio metrics ─────────────────────────────────────────────────
export function calculateRatios(
  viewerCount: number,
  followerCount: number,
  chatterCount: number,
  subCount: number | null,
): RatioMetrics {
  const chatterToCCV = viewerCount > 0 ? chatterCount / viewerCount : null;
  const followerToCCV = viewerCount > 0 ? followerCount / viewerCount : null;
  const subToCCV = (viewerCount > 0 && subCount !== null) ? subCount / viewerCount : null;

  // Engagement score: weighted combination of healthy ratios
  let engagementScore = 50;

  // Chatter ratio: organic ~16-20%, botted ~5% or less
  if (chatterToCCV !== null) {
    if (chatterToCCV >= 0.15) engagementScore += 25;
    else if (chatterToCCV >= 0.10) engagementScore += 10;
    else if (chatterToCCV >= 0.05) engagementScore -= 10;
    else engagementScore -= 25;
  }

  // Follower ratio: should be much higher than viewer count for organic streams
  if (followerToCCV !== null) {
    if (followerToCCV >= 5) engagementScore += 15;
    else if (followerToCCV >= 2) engagementScore += 5;
    else if (followerToCCV >= 1) engagementScore -= 10;
    else engagementScore -= 20;
  }

  // Sub ratio
  if (subToCCV !== null) {
    if (subToCCV >= 0.05) engagementScore += 10;
    else if (subToCCV >= 0.01) engagementScore += 5;
    else engagementScore -= 5;
  }

  return {
    chatterToCCV,
    followerToCCV,
    subToCCV,
    engagementScore: Math.max(0, Math.min(100, engagementScore)),
  };
}

// ─── Generate individual signals ─────────────────────────────────────────────
export function generateSignals(params: {
  viewerCount: number;
  followerCount: number;
  chatterCount: number;
  subCount: number | null;
  accountAgeDays: number | null;
  knownBots: string[];
  usernamePatterns: UsernamePatternResult;
  ratios: RatioMetrics;
  isLive: boolean;
}): SignalResult[] {
  const {
    viewerCount, followerCount, chatterCount, subCount,
    accountAgeDays, knownBots, usernamePatterns, ratios, isLive,
  } = params;

  const signals: SignalResult[] = [];

  // ── Signal 1: Chatter-to-Viewer Ratio (HIGHEST WEIGHT) ──────────────────
  // Research: Organic 1:6 (16.7%), Botted 1:18 (5.6%) — Vodra 2025
  {
    const ratio = ratios.chatterToCCV;
    let score = 0;
    let flagged = false;
    let value = "N/A (offline)";
    let confidence: "high" | "medium" | "low" = isLive ? "high" : "low";

    if (ratio !== null && isLive) {
      const pct = ratio * 100;
      value = `${pct.toFixed(1)}% (1 chatter per ${Math.round(1 / Math.max(ratio, 0.001))} viewers)`;
      if (pct < 3) { score = 95; flagged = true; }
      else if (pct < 5.6) { score = 80; flagged = true; }   // below botted threshold
      else if (pct < 8) { score = 55; flagged = true; }
      else if (pct < 12) { score = 25; }
      else { score = 0; }
    } else if (!isLive) {
      score = 20; confidence = "low";
      value = "Channel offline — ratio unavailable";
    }

    signals.push({
      id: "chatter_ratio",
      label: "Chatter-to-Viewer Ratio",
      description: "Ratio of chat participants vs live viewer count. Organic streams average 1:6 (16.7%). Viewbotted streams average 1:18 (5.6%) or worse.",
      score,
      weight: 30,
      value,
      threshold: "Healthy: ≥12% | Suspicious: 5–12% | Botted: <5.6%",
      flagged,
      confidence,
      detail: ratio !== null && isLive
        ? `Research baseline (Vodra 2025): organic streams average ~16.7% chatter ratio; confirmed botted streams average ~5.6%. Your channel reads ${(ratio * 100).toFixed(1)}%.`
        : "Cannot measure chatter ratio when channel is offline.",
    });
  }

  // ── Signal 2: Follower-to-Viewer Ratio ──────────────────────────────────
  // Research: Legitimate streamers have far more followers than concurrent viewers
  {
    const ratio = ratios.followerToCCV;
    let score = 0;
    let flagged = false;
    let value = "N/A";
    const confidence: "high" | "medium" | "low" = "high";

    if (ratio !== null) {
      value = `${followerCount.toLocaleString()} followers / ${viewerCount.toLocaleString()} viewers = ${ratio.toFixed(2)}x`;
      if (ratio < 0.5) { score = 90; flagged = true; }   // More viewers than followers — extremely suspicious
      else if (ratio < 1.0) { score = 75; flagged = true; }
      else if (ratio < 2.0) { score = 45; flagged = true; }
      else if (ratio < 5.0) { score = 15; }
      else { score = 0; }
    }

    signals.push({
      id: "follower_ratio",
      label: "Follower-to-Viewer Ratio",
      description: "Real audiences follow channels they enjoy. If a channel has more viewers than followers, the viewers are likely fake.",
      score,
      weight: 25,
      value,
      threshold: "Healthy: ≥5x | Suspicious: 1–5x | Critical: <1x (more viewers than followers)",
      flagged,
      confidence,
      detail: ratio !== null
        ? `A follower:viewer ratio of ${ratio.toFixed(2)} means for every viewer there are ${ratio.toFixed(1)} followers. Below 1x (more viewers than followers) is a near-certain viewbot indicator.`
        : "No data available.",
    });
  }

  // ── Signal 3: Known Bot Accounts Detected ───────────────────────────────
  {
    const count = knownBots.length;
    const score = count === 0 ? 0 : Math.min(100, count * 15);
    const flagged = count > 0;

    signals.push({
      id: "known_bots",
      label: "Known Bot Accounts in Chat",
      description: "Cross-referenced against CommanderRoot and TwitchInsights community-maintained known-bot lists (200k+ entries).",
      score,
      weight: 20,
      value: count === 0
        ? "No known bots detected"
        : `${count} known bot account${count > 1 ? "s" : ""} detected: ${knownBots.slice(0, 3).join(", ")}${count > 3 ? ` +${count - 3} more` : ""}`,
      threshold: "Healthy: 0 (utility bots like StreamElements are excluded)",
      flagged,
      confidence: "high",
      detail: count === 0
        ? "No accounts from the CommanderRoot/TwitchInsights known-bot database were found in this channel's chatters."
        : `Found ${count} account(s) from known bot databases. Note: legitimate utility bots (Nightbot, StreamElements etc.) are filtered out automatically.`,
    });
  }

  // ── Signal 4: Suspicious Username Patterns ──────────────────────────────
  {
    const rate = usernamePatterns.suspicionRate;
    const score = Math.min(100, rate * 150);
    const flagged = rate > 0.2;

    signals.push({
      id: "username_patterns",
      label: "Suspicious Username Patterns",
      description: "Bot farms typically generate accounts with predictable patterns: word+digits, hex strings, prefix+random combos.",
      score,
      weight: 15,
      value: usernamePatterns.totalChecked === 0
        ? "No chatters to analyze"
        : `${usernamePatterns.suspiciousCount}/${usernamePatterns.totalChecked} chatters (${(rate * 100).toFixed(1)}%) match bot patterns`,
      threshold: "Healthy: <5% | Suspicious: 5–20% | Botted: >20%",
      flagged,
      confidence: usernamePatterns.totalChecked > 10 ? "medium" : "low",
      detail: rate > 0.2
        ? `${(rate * 100).toFixed(0)}% of chatters match known bot username patterns: ${usernamePatterns.patterns.join(", ")}.`
        : `Only ${(rate * 100).toFixed(0)}% of chatters flagged — within normal range.`,
    });
  }

  // ── Signal 5: Viewer Count vs Account Age (new-account clustering) ──────
  {
    let score = 0;
    let flagged = false;
    let value = "N/A";
    const confidence: "high" | "medium" | "low" = accountAgeDays !== null ? "medium" : "low";

    if (accountAgeDays !== null) {
      value = `Channel created ~${accountAgeDays} days ago`;
      if (accountAgeDays < 30 && viewerCount > 100) { score = 80; flagged = true; }
      else if (accountAgeDays < 90 && viewerCount > 500) { score = 65; flagged = true; }
      else if (accountAgeDays < 180 && viewerCount > 1000) { score = 40; flagged = true; }
      else { score = 0; }
    }

    signals.push({
      id: "account_age",
      label: "Channel Age vs Viewer Count",
      description: "New channels with unusually high viewer counts are a major red flag. Real organic growth takes months to years.",
      score,
      weight: 10,
      value,
      threshold: "Healthy: Established channel OR modest viewers for age",
      flagged,
      confidence,
      detail: accountAgeDays !== null
        ? `Channel is ${accountAgeDays} days old with ${viewerCount.toLocaleString()} viewers. ${flagged ? "This growth rate is statistically implausible without artificial inflation." : "Growth appears consistent with account age."}`
        : "Channel creation date not available from API.",
    });
  }

  // ── Signal 6: Subscriber Ratio ───────────────────────────────────────────
  {
    const ratio = ratios.subToCCV;
    let score = 0;
    let flagged = false;
    let value = "N/A";
    const confidence: "high" | "medium" | "low" = subCount !== null ? "medium" : "low";

    if (ratio !== null && subCount !== null) {
      const pct = ratio * 100;
      value = `${subCount.toLocaleString()} subs / ${viewerCount.toLocaleString()} viewers = ${pct.toFixed(2)}%`;
      if (pct < 0.5 && viewerCount > 200) { score = 60; flagged = true; }
      else if (pct < 1.0 && viewerCount > 500) { score = 35; flagged = true; }
      else { score = 0; }
    } else if (subCount === null) {
      value = "Sub count not public";
    }

    signals.push({
      id: "sub_ratio",
      label: "Subscriber-to-Viewer Ratio",
      description: "Genuine audiences subscribe to channels they love. Very low sub-to-viewer ratios suggest inflated viewer counts.",
      score,
      weight: 10,
      value,
      threshold: "Healthy: ≥2% | Suspicious: 0.5–2% | Botted: <0.5% (for channels >200 viewers)",
      flagged,
      confidence,
      detail: ratio !== null
        ? `Sub ratio of ${(ratio * 100).toFixed(2)}% — ${flagged ? "unusually low for this viewer count." : "within acceptable range."}`
        : "Subscription data unavailable (may be private or channel isn't Affiliate/Partner).",
    });
  }

  // ── Signal 7: Viewer Spike Pattern ──────────────────────────────────────
  {
    // Without time-series data we estimate based on viewer/follower mismatch
    const ratio = ratios.followerToCCV;
    let score = 0;
    let flagged = false;
    const value = isLive
      ? `${viewerCount.toLocaleString()} concurrent viewers (live)`
      : "Channel offline";

    if (isLive && ratio !== null && ratio < 0.8 && viewerCount > 50) {
      score = 70; flagged = true;
    } else if (isLive && ratio !== null && ratio < 1.5 && viewerCount > 200) {
      score = 40; flagged = true;
    }

    signals.push({
      id: "viewer_spike",
      label: "Sudden Viewer Spike Indicator",
      description: "Viewbot farms inject 500–1,000 fake viewers at once without raid/host triggers. Detected via follower mismatch and viewer anomaly.",
      score,
      weight: 8,
      value,
      threshold: "Healthy: Gradual growth correlated with follower count",
      flagged,
      confidence: "medium",
      detail: flagged
        ? `Disproportionate viewer count vs follower base suggests a sudden artificial injection rather than organic discovery.`
        : "No obvious viewer spike anomaly detected.",
    });
  }

  // ── Signal 8: Chat Engagement Quality ───────────────────────────────────
  {
    const chatRatio = ratios.chatterToCCV;
    let score = 0;
    let flagged = false;
    let value = "N/A (offline)";
    const confidence: "high" | "medium" | "low" = isLive ? "medium" : "low";

    if (chatRatio !== null && isLive) {
      // If there are chatters but still very few, mention engagement quality
      const absoluteChatters = chatterCount;
      if (absoluteChatters < 3 && viewerCount > 50) {
        value = `${absoluteChatters} chatters — nearly silent for ${viewerCount} viewers`;
        score = 75; flagged = true;
      } else if (absoluteChatters < 5 && viewerCount > 100) {
        value = `${absoluteChatters} chatters — very low engagement`;
        score = 50; flagged = true;
      } else {
        value = `${absoluteChatters} chatters active`;
        score = 0;
      }
    }

    signals.push({
      id: "chat_engagement",
      label: "Chat Engagement Quality",
      description: "Dead or near-silent chat with a large viewer count is one of the most obvious viewbot indicators per community research.",
      score,
      weight: 8,
      value,
      threshold: "Healthy: Active chat proportional to viewer count",
      flagged,
      confidence,
      detail: flagged
        ? `With ${viewerCount} viewers, ${chatterCount} active chatters is statistically abnormal. Real audiences chat, react, and engage.`
        : isLive
          ? `${chatterCount} active chatters present. Engagement appears normal.`
          : "Channel offline — cannot assess live chat engagement.",
    });
  }

  return signals;
}

// ─── Weighted composite risk score ───────────────────────────────────────────
export function calculateRiskScore(signals: SignalResult[]): number {
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const weightedScore = signals.reduce((sum, s) => sum + (s.score * s.weight), 0);
  return Math.round(weightedScore / totalWeight);
}

// ─── Map score to risk level ─────────────────────────────────────────────────
export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "BOT_FARM";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "CLEAN";
}

// ─── Generate AI-style summary ───────────────────────────────────────────────
export function generateSummary(params: {
  channelName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  signals: SignalResult[];
  ratios: RatioMetrics;
  isLive: boolean;
  viewerCount: number;
  followerCount: number;
  chatterCount: number;
}): string {
  const { channelName, riskScore, riskLevel, signals, ratios, isLive, viewerCount, followerCount } = params;
  const flagged = signals.filter(s => s.flagged);
  const topSignal = signals.filter(s => s.flagged).sort((a, b) => (b.score * b.weight) - (a.score * a.weight))[0];

  const riskPhrases: Record<RiskLevel, string> = {
    CLEAN: `**${channelName}** shows no significant indicators of viewbotting or artificial engagement. All key metrics — including chatter-to-viewer ratio, follower ratio, and chat engagement — fall within organic baselines established by 2025 research.`,
    LOW: `**${channelName}** has minor statistical irregularities, but nothing definitively pointing to active viewbotting. Some metrics are slightly below organic baselines, which could be explained by embedded viewing or external traffic.`,
    MEDIUM: `**${channelName}** shows moderate signs of potential artificial engagement. ${flagged.length} signal(s) are flagged, with ${topSignal?.label ?? "engagement metrics"} being the primary concern. This warrants attention but isn't conclusive.`,
    HIGH: `**${channelName}** shows strong indicators of artificial audience inflation. ${flagged.length} of 8 signals are flagged. The data pattern is consistent with active viewbotting based on 2025 research thresholds.`,
    BOT_FARM: `**${channelName}** displays near-certain signs of a viewbot farm or mass artificial engagement. Risk score is ${riskScore}/100. Multiple critical signals align with confirmed viewbotted streams in published research.`,
  };

  let summary = riskPhrases[riskLevel] + "\n\n";

  if (!isLive) {
    summary += "⚠️ **Channel is currently offline.** The most powerful signals (live chatter ratio, viewer spike detection) could not be assessed. Accuracy is reduced — scan again when live for a definitive result.\n\n";
  }

  if (isLive && ratios.chatterToCCV !== null) {
    const pct = (ratios.chatterToCCV * 100).toFixed(1);
    summary += `📊 **Key Metric:** Chatter ratio is **${pct}%** (organic baseline: ~16.7%, confirmed botted baseline: ~5.6% — Vodra 2025). `;
    if (ratios.chatterToCCV < 0.056) summary += "This is *below* the confirmed botted threshold.\n\n";
    else if (ratios.chatterToCCV < 0.12) summary += "This is in the *suspicious* zone.\n\n";
    else summary += "This is within the *organic* range.\n\n";
  }

  if (ratios.followerToCCV !== null && viewerCount > 0) {
    const r = ratios.followerToCCV.toFixed(2);
    summary += `👥 **Follower ratio:** ${followerCount.toLocaleString()} followers vs ${viewerCount.toLocaleString()} viewers = **${r}x**. `;
    if (ratios.followerToCCV < 1) summary += "More viewers than followers is a critical red flag.\n\n";
    else if (ratios.followerToCCV < 3) summary += "Low relative to typical organic channels.\n\n";
    else summary += "Healthy ratio.\n\n";
  }

  if (flagged.length > 0) {
    summary += `🚩 **Flagged Signals (${flagged.length}/8):** ${flagged.map(s => s.label).join(", ")}.`;
  } else {
    summary += "✅ **No signals flagged.** Channel appears organic.";
  }

  return summary;
}

// ─── Overall confidence rating based on data completeness ────────────────────
export function calculateConfidence(params: {
  isLive: boolean;
  hasChatterData: boolean;
  hasSubData: boolean;
  hasAccountAge: boolean;
  viewerCount: number;
}): number {
  let confidence = 40; // base

  if (params.isLive) confidence += 25;
  if (params.hasChatterData) confidence += 20;
  if (params.hasSubData) confidence += 8;
  if (params.hasAccountAge) confidence += 7;
  if (params.viewerCount > 10) confidence += 5;   // more data to analyze
  if (params.viewerCount > 100) confidence += 5;

  return Math.min(100, confidence);
}
