// ─── Twitch API helpers (client-side, public endpoints) ──────────────────────
// Uses Twitch Helix API via CORS proxy pattern where needed.
// For full accuracy, users should configure their own Twitch Client ID.
// Without credentials, we use TMI.js chatters endpoint (public) for chatter data.

export interface TwitchChannel {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: string;
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number;
  created_at: string;
  follower_count?: number;
}

export interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
  tags: string[];
}

export interface TwitchChatters {
  chatters: string[];
  chatter_count: number;
}

// ─── Get Twitch App Access Token ─────────────────────────────────────────────
export async function getTwitchAppToken(clientId: string, clientSecret: string): Promise<string> {
  const resp = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!resp.ok) throw new Error("Failed to get Twitch token");
  const data = await resp.json();
  return data.access_token as string;
}

// ─── Fetch channel info ───────────────────────────────────────────────────────
export async function fetchChannelInfo(
  login: string,
  clientId: string,
  token: string,
): Promise<TwitchChannel | null> {
  const url = `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`;
  const resp = await fetch(url, {
    headers: {
      "Client-ID": clientId,
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.data?.[0] ?? null;
}

// ─── Fetch follower count ─────────────────────────────────────────────────────
export async function fetchFollowerCount(
  broadcasterId: string,
  clientId: string,
  token: string,
): Promise<number> {
  const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=1`;
  const resp = await fetch(url, {
    headers: {
      "Client-ID": clientId,
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!resp.ok) return 0;
  const data = await resp.json();
  return data.total ?? 0;
}

// ─── Fetch live stream info ────────────────────────────────────────────────────
export async function fetchStreamInfo(
  login: string,
  clientId: string,
  token: string,
): Promise<TwitchStream | null> {
  const url = `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`;
  const resp = await fetch(url, {
    headers: {
      "Client-ID": clientId,
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.data?.[0] ?? null;
}

// ─── Fetch chatters (public endpoint - no auth needed) ───────────────────────
export async function fetchChatters(login: string): Promise<TwitchChatters> {
  // TMI chatters endpoint - public, no auth needed
  try {
    const url = `https://tmi.twitch.tv/group/user/${login.toLowerCase()}/chatters`;
    const resp = await fetch(url);
    if (!resp.ok) return { chatters: [], chatter_count: 0 };
    const data = await resp.json();
    const allChatters: string[] = [
      ...(data.chatters?.broadcaster ?? []),
      ...(data.chatters?.vips ?? []),
      ...(data.chatters?.moderators ?? []),
      ...(data.chatters?.staff ?? []),
      ...(data.chatters?.admins ?? []),
      ...(data.chatters?.global_mods ?? []),
      ...(data.chatters?.viewers ?? []),
    ];
    return {
      chatters: allChatters,
      chatter_count: data.chatter_count ?? allChatters.length,
    };
  } catch {
    return { chatters: [], chatter_count: 0 };
  }
}

// ─── Fetch subscriber count ───────────────────────────────────────────────────
export async function fetchSubscriberCount(
  broadcasterId: string,
  clientId: string,
  token: string,
): Promise<number | null> {
  try {
    const url = `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}&first=1`;
    const resp = await fetch(url, {
      headers: {
        "Client-ID": clientId,
        "Authorization": `Bearer ${token}`,
      },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.total ?? null;
  } catch {
    return null;
  }
}

// ─── Account age in days ─────────────────────────────────────────────────────
export function accountAgeDays(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}
