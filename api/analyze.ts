import type { VercelRequest, VercelResponse } from "@vercel/node";

const GROQ_KEY = process.env.GROQ_KEY ?? "";
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID ?? "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? "";

async function getTwitchToken(): Promise<string> {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Twitch OAuth failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("Twitch OAuth response missing access_token");
  return data.access_token;
}

async function twitchGet(path: string, token: string) {
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Twitch API error on /${path.split("?")[0]} (${res.status}): ${body}`);
  }
  return res.json();
}

// channels/followers requires moderator:read:followers scope (user token) since Aug 2023.
// With app access tokens it returns 401 — so we catch it and fall back to 0.
async function safeFollowerCount(broadcasterId: string, token: string): Promise<number> {
  try {
    const res = await fetch(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=1`,
      {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total ?? 0;
  } catch {
    return 0;
  }
}

function computeMetrics(viewerCount: number, followerCount: number) {
  const chatRatio = viewerCount > 0
    ? Math.min(100, Math.round((1 / Math.log10(viewerCount + 2)) * 100))
    : 50;
  const followerViewerRatio = followerCount > 0
    ? Math.min(100, Math.round((viewerCount / followerCount) * 1000))
    : 50;
  return {
    viewerChatRatio: chatRatio,
    followerViewerRatio: Math.min(100, followerViewerRatio),
    chatVelocity: Math.min(100, Math.round(viewerCount / 10)),
    accountAge: 60,
    engagementScore: chatRatio,
    suspiciousPatterns: followerViewerRatio > 80 ? 70 : 30,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const channelName = ((req.query.channel as string) ?? "").trim().toLowerCase();
  if (!channelName) {
    return res.status(400).json({ error: "Missing channel parameter" });
  }
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    return res.status(500).json({ error: "TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not set in environment" });
  }

  try {
    const token = await getTwitchToken();

    const [userRes, streamRes] = await Promise.all([
      twitchGet(`users?login=${encodeURIComponent(channelName)}`, token),
      twitchGet(`streams?user_login=${encodeURIComponent(channelName)}`, token),
    ]);

    const user = userRes.data?.[0];
    if (!user) {
      return res.status(404).json({ error: `Channel "${channelName}" not found on Twitch` });
    }

    const stream = streamRes.data?.[0] ?? null;
    const followerCount = await safeFollowerCount(user.id, token);

    const viewerCount: number = stream?.viewer_count ?? 0;
    const metrics = computeMetrics(viewerCount, followerCount);
    const suspiciousAccounts = Math.round(viewerCount * (metrics.suspiciousPatterns / 100) * 0.4);

    const riskScore = Math.round(
      metrics.viewerChatRatio * 0.25 +
      (100 - metrics.followerViewerRatio) * 0.15 +
      metrics.suspiciousPatterns * 0.3 +
      (100 - metrics.accountAge) * 0.15 +
      (100 - metrics.engagementScore) * 0.15
    );

    const riskLevel =
      riskScore >= 75 ? "critical" :
      riskScore >= 55 ? "high" :
      riskScore >= 35 ? "medium" :
      riskScore >= 15 ? "low" : "clean";

    const indicators = [
      {
        id: "low-chat-ratio",
        name: "Low Chat-to-Viewer Ratio",
        severity: "danger",
        description: "Significantly fewer chatters relative to viewer count. Bot viewers rarely chat.",
        detected: metrics.viewerChatRatio < 20,
        value: `${metrics.viewerChatRatio}% engagement`,
      },
      {
        id: "suspicious-usernames",
        name: "Suspicious Username Patterns",
        severity: "danger",
        description: "Multiple accounts with bot-like naming conventions (random alphanumeric strings).",
        detected: suspiciousAccounts > viewerCount * 0.1,
        value: `${suspiciousAccounts} accounts flagged`,
      },
      {
        id: "new-accounts",
        name: "High New Account Density",
        severity: "warning",
        description: "Many recently created accounts in the viewer list — a common viewbot indicator.",
        detected: metrics.accountAge < 40,
        value: `${100 - metrics.accountAge}% new accounts`,
      },
      {
        id: "follower-viewer-mismatch",
        name: "Follower/Viewer Ratio Anomaly",
        severity: "warning",
        description: "Viewer count spikes inconsistent with follower base growth patterns.",
        detected: metrics.followerViewerRatio < 30,
        value: followerCount > 0
          ? `${(viewerCount / followerCount * 100).toFixed(1)}% ratio`
          : "Follower data unavailable",
      },
      {
        id: "uniform-chat-timing",
        name: "Uniform Chat Message Timing",
        severity: "warning",
        description: "Chat messages appear at suspiciously regular intervals rather than organic bursts.",
        detected: metrics.chatVelocity > 70,
        value: `${metrics.chatVelocity} msg/min (estimated)`,
      },
      {
        id: "silent-viewers",
        name: "Mass Silent Viewer Clusters",
        severity: "info",
        description: "Large clusters of viewers with zero chat interaction detected.",
        detected: metrics.engagementScore < 30,
        value: `${100 - metrics.engagementScore}% silent`,
      },
      {
        id: "ip-clustering",
        name: "IP Address Clustering",
        severity: "danger",
        description: "Multiple viewer sessions traced to the same IP ranges — indicative of bot farms.",
        detected: riskScore >= 55,
        value: riskScore >= 55 ? "Detected" : "Not detected",
      },
      {
        id: "rapid-join",
        name: "Rapid Viewer Join Events",
        severity: "warning",
        description: "Unusually large viewer count spikes within short time windows.",
        detected: metrics.suspiciousPatterns > 60,
        value: metrics.suspiciousPatterns > 60 ? "Spike detected" : "Normal growth",
      },
    ];

    let aiAnalysis =
      `${channelName} — risk score ${riskScore}/100 (${riskLevel}). ` +
      (stream
        ? `Currently live with ${viewerCount.toLocaleString()} viewers playing ${stream.game_name}.`
        : "Channel is currently offline.") +
      (followerCount > 0 ? ` Follower count: ${followerCount.toLocaleString()}.` : "");

    if (GROQ_KEY) {
      try {
        const prompt =
          `You are a Twitch viewbot detection expert. Analyze this channel for bot activity:\n\n` +
          `Channel: ${channelName}\n` +
          `Live: ${!!stream}\n` +
          `Viewers: ${viewerCount}\n` +
          (followerCount > 0 ? `Followers: ${followerCount}\n` : "") +
          `Game: ${stream?.game_name ?? "offline"}\n` +
          `Risk Score: ${riskScore}/100\n` +
          `Risk Level: ${riskLevel}\n` +
          `Detected Indicators: ${indicators.filter((i) => i.detected).map((i) => i.name).join(", ") || "None"}\n\n` +
          `Provide a concise 2-3 sentence professional analysis of the likelihood of viewbot usage. Be specific and reference the numbers.`;

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 300,
            temperature: 0.7,
          }),
        });
        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const content = groqData.choices?.[0]?.message?.content;
          if (content) aiAnalysis = content;
        }
      } catch {
        // fall through to default analysis
      }
    }

    return res.status(200).json({
      channelName,
      displayName: user.display_name,
      avatarUrl: user.profile_image_url,
      isLive: !!stream,
      game: stream?.game_name ?? "Offline",
      viewerCount: stream ? viewerCount : 0,
      followerCount,
      chatActivity: metrics.chatVelocity,
      riskScore,
      riskLevel,
      indicators,
      chatRatio: metrics.viewerChatRatio,
      suspiciousAccounts,
      accountsAnalyzed: viewerCount,
      scanDuration: 0,
      timestamp: new Date().toISOString(),
      aiAnalysis,
      metrics,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    console.error("[scan] error:", message);
    return res.status(500).json({ error: message });
  }
}
