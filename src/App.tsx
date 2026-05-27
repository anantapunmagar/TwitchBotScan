import { useState, useCallback, useEffect } from "react";
import {
  Shield, Bot, AlertTriangle, CheckCircle, XCircle,
  Search, RefreshCw, Clock, ChevronDown, ChevronUp,
  Info, TrendingUp, Users, MessageSquare, Star,
  Eye, BarChart2, Target, Cpu, AlertCircle,
  ExternalLink
} from "lucide-react";

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.303 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
);
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell
} from "recharts";
import { scanChannel } from "./lib/scanner";
import type { ScanResult, RiskLevel, SignalResult } from "./lib/botDetection";

// ─── Types ────────────────────────────────────────────────────────────────────
interface HistoryEntry {
  channelName: string;
  displayName: string;
  riskLevel: RiskLevel;
  riskScore: number;
  isLive: boolean;
  scanTime: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const RISK_CONFIG: Record<RiskLevel, {
  label: string; color: string; bg: string; border: string;
  icon: React.FC<{ className?: string }>;
  textColor: string; barColor: string; description: string;
}> = {
  CLEAN: {
    label: "Clean", color: "#22c55e", bg: "bg-green-500/10", border: "border-green-500/30",
    icon: CheckCircle, textColor: "text-green-400", barColor: "#22c55e",
    description: "No significant bot activity detected",
  },
  LOW: {
    label: "Low Risk", color: "#84cc16", bg: "bg-lime-500/10", border: "border-lime-500/30",
    icon: Shield, textColor: "text-lime-400", barColor: "#84cc16",
    description: "Minor anomalies — likely organic",
  },
  MEDIUM: {
    label: "Suspicious", color: "#f59e0b", bg: "bg-amber-500/10", border: "border-amber-500/30",
    icon: AlertTriangle, textColor: "text-amber-400", barColor: "#f59e0b",
    description: "Multiple suspicious signals detected",
  },
  HIGH: {
    label: "High Risk", color: "#ef4444", bg: "bg-red-500/10", border: "border-red-500/30",
    icon: XCircle, textColor: "text-red-400", barColor: "#ef4444",
    description: "Strong viewbotting indicators present",
  },
  BOT_FARM: {
    label: "Bot Farm", color: "#dc2626", bg: "bg-red-900/20", border: "border-red-500/50",
    icon: Bot, textColor: "text-red-500", barColor: "#dc2626",
    description: "Near-certain artificial audience inflation",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── RiskGauge ────────────────────────────────────────────────────────────────
function RiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  const cfg = RISK_CONFIG[level];
  const angle = (score / 100) * 180;
  const r = 70;
  const cx = 100;
  const cy = 90;
  const toRad = (deg: number) => (deg - 180) * (Math.PI / 180);
  const needleX = cx + r * Math.cos(toRad(angle));
  const needleY = cy + r * Math.sin(toRad(angle));

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 110" className="w-48 h-28">
        {/* Background arc segments */}
        {[
          { color: "#22c55e", start: 0, end: 36 },
          { color: "#84cc16", start: 36, end: 72 },
          { color: "#f59e0b", start: 72, end: 108 },
          { color: "#ef4444", start: 108, end: 144 },
          { color: "#dc2626", start: 144, end: 180 },
        ].map(({ color, start, end }) => {
          const startRad = ((start - 180) * Math.PI) / 180;
          const endRad = ((end - 180) * Math.PI) / 180;
          const x1 = cx + r * Math.cos(startRad);
          const y1 = cy + r * Math.sin(startRad);
          const x2 = cx + r * Math.cos(endRad);
          const y2 = cy + r * Math.sin(endRad);
          const largeArc = end - start > 90 ? 1 : 0;
          return (
            <path
              key={color}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              stroke={color}
              strokeWidth="10"
              fill="none"
              strokeLinecap="butt"
              opacity="0.7"
            />
          );
        })}
        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={needleX} y2={needleY}
          stroke={cfg.color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill={cfg.color} />
        {/* Score label */}
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="18" fontWeight="bold" fill={cfg.color}>
          {score}
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" fontSize="8" fill="#94a3b8">
          / 100
        </text>
      </svg>
      <span className={`text-sm font-bold tracking-wider uppercase ${cfg.textColor}`}>
        {cfg.label}
      </span>
      <span className="text-xs text-slate-400 text-center">{cfg.description}</span>
    </div>
  );
}

// ─── SignalCard ───────────────────────────────────────────────────────────────
function SignalCard({ signal }: { signal: SignalResult }) {
  const [expanded, setExpanded] = useState(false);
  const pct = signal.weight > 0 ? Math.round((signal.score / 100) * signal.weight) : 0;

  return (
    <div className={`rounded-xl border transition-all duration-200 ${
      signal.flagged
        ? "border-red-500/30 bg-red-900/10"
        : "border-slate-700/50 bg-slate-800/30"
    }`}>
      <button
        className="w-full flex items-start gap-3 p-4 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
          signal.flagged ? "bg-red-400" : "bg-green-400"
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${signal.flagged ? "text-red-300" : "text-slate-200"}`}>
              {signal.label}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                signal.confidence === "high"
                  ? "border-blue-500/40 text-blue-400 bg-blue-500/10"
                  : signal.confidence === "medium"
                    ? "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
                    : "border-slate-600 text-slate-400 bg-slate-800"
              }`}>
                {signal.confidence} confidence
              </span>
              <span className={`text-xs font-bold w-10 text-right ${
                signal.flagged ? "text-red-400" : "text-slate-400"
              }`}>
                {signal.score}/100
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{signal.value}</p>
          {/* Weight bar */}
          <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                signal.flagged ? "bg-red-500" : "bg-green-500"
              }`}
              style={{ width: `${signal.score}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-600 mt-1">
            Weight: {signal.weight}% of total score · Contributes {pct} points
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/30 pt-3 space-y-2">
          <p className="text-xs text-slate-300 leading-relaxed">{signal.description}</p>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Analysis</p>
            <p className="text-xs text-slate-300 leading-relaxed">{signal.detail}</p>
          </div>
          <div className="flex items-start gap-1.5 bg-slate-900/50 rounded-lg p-2">
            <Info className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400">Threshold: {signal.threshold}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RadarChart component ─────────────────────────────────────────────────────
function BotRadarChart({ signals }: { signals: SignalResult[] }) {
  const data = signals.map(s => ({
    name: s.label.split(" ").slice(0, 2).join(" "),
    score: s.score,
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data}>
        <PolarGrid stroke="#334155" />
        <PolarAngleAxis
          dataKey="name"
          tick={{ fontSize: 9, fill: "#94a3b8" }}
        />
        <Radar
          name="Bot Risk"
          dataKey="score"
          stroke="#a855f7"
          fill="#a855f7"
          fillOpacity={0.25}
          strokeWidth={1.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── Signal bar chart ─────────────────────────────────────────────────────────
function SignalBarChart({ signals }: { signals: SignalResult[] }) {
  const data = signals.map(s => ({
    name: s.label.replace("Ratio", "").replace("Pattern", "Pat.").replace("Suspicious ", "").trim(),
    score: s.score,
    flagged: s.flagged,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: "#64748b" }} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 9, fill: "#94a3b8" }}
          width={110}
        />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }}
          formatter={(v) => [`${v}/100`, "Risk Score"]}
        />
        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.flagged ? "#ef4444" : "#22c55e"} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Results Panel ────────────────────────────────────────────────────────────
function ResultsPanel({
  result,
  onRescan,
  onNewScan,
}: {
  result: ScanResult;
  onRescan: () => void;
  onNewScan: () => void;
}) {
  const cfg = RISK_CONFIG[result.riskLevel];
  const Icon = cfg.icon;
  const flaggedCount = result.signals.filter(s => s.flagged).length;

  // Parse markdown-style bold from summary
  const renderSummary = (text: string) =>
    text.split("\n").map((line, i) => {
      const parts = line.split(/\*\*(.+?)\*\*/g);
      return (
        <p key={i} className="text-sm text-slate-300 leading-relaxed mb-1.5">
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{part}</strong> : part
          )}
        </p>
      );
    });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${cfg.bg} ${cfg.border}`}>
            <Icon className={`w-5 h-5 ${cfg.textColor}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {result.displayName}
              {result.isLive && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold animate-pulse">
                  LIVE
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              twitch.tv/{result.channelName} · Scanned {timeAgo(result.scanTime)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRescan}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-600 hover:border-purple-500 text-slate-300 hover:text-white transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Rescan
          </button>
          <button
            onClick={onNewScan}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all"
          >
            <Search className="w-3.5 h-3.5" /> New Scan
          </button>
        </div>
      </div>

      {/* Offline warning */}
      {!result.isLive && (
        <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Channel is Offline — Reduced Accuracy</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Live chatter ratio analysis (the strongest signal) is unavailable. Scan again when the channel is live for maximum accuracy. Current confidence: <strong>{result.confidence}%</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Gauge + stats */}
        <div className="space-y-4">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
            <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-4 text-center">
              Risk Assessment
            </h3>
            <RiskGauge score={result.riskScore} level={result.riskLevel} />
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-900/50 rounded-lg p-2">
                <p className="text-xs text-slate-500">Confidence</p>
                <p className="text-lg font-bold text-white">{result.confidence}%</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2">
                <p className="text-xs text-slate-500">Flags</p>
                <p className={`text-lg font-bold ${flaggedCount > 0 ? "text-red-400" : "text-green-400"}`}>
                  {flaggedCount}/{result.signals.length}
                </p>
              </div>
            </div>
          </div>

          {/* Key metrics */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Key Metrics</h3>
            {[
              {
                icon: Eye,
                label: "Viewers",
                value: result.isLive ? formatNumber(result.viewerCount) : "Offline",
                color: result.isLive ? "text-white" : "text-slate-500",
              },
              {
                icon: Users,
                label: "Followers",
                value: formatNumber(result.followerCount),
                color: "text-white",
              },
              {
                icon: MessageSquare,
                label: "Chatters",
                value: result.isLive ? result.chatterCount.toString() : "N/A",
                color: result.isLive ? "text-white" : "text-slate-500",
              },
              {
                icon: BarChart2,
                label: "Chat Ratio",
                value: result.ratios.chatterToCCV !== null && result.isLive
                  ? `${(result.ratios.chatterToCCV * 100).toFixed(1)}%`
                  : "N/A",
                color: result.ratios.chatterToCCV !== null && result.ratios.chatterToCCV < 0.056
                  ? "text-red-400"
                  : result.ratios.chatterToCCV !== null && result.ratios.chatterToCCV < 0.12
                    ? "text-amber-400"
                    : "text-green-400",
              },
              {
                icon: TrendingUp,
                label: "Follower Ratio",
                value: result.ratios.followerToCCV !== null
                  ? `${result.ratios.followerToCCV.toFixed(1)}x`
                  : "N/A",
                color: result.ratios.followerToCCV !== null && result.ratios.followerToCCV < 1
                  ? "text-red-400"
                  : result.ratios.followerToCCV !== null && result.ratios.followerToCCV < 3
                    ? "text-amber-400"
                    : "text-green-400",
              },
            ].map(({ icon: Ic, label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ic className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs text-slate-400">{label}</span>
                </div>
                <span className={`text-sm font-semibold ${color}`}>{value}</span>
              </div>
            ))}

            {result.knownBots.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700/50">
                <p className="text-xs text-red-400 font-semibold mb-1">
                  ⚠ Known bots detected: {result.knownBots.length}
                </p>
                <p className="text-[10px] text-slate-500 break-all">
                  {result.knownBots.slice(0, 4).join(", ")}
                  {result.knownBots.length > 4 && ` +${result.knownBots.length - 4} more`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Center + Right: Charts */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          <div className={`border rounded-2xl p-5 ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-4 h-4 ${cfg.textColor}`} />
              <h3 className="text-sm font-semibold text-white">Analysis Summary</h3>
              <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.textColor} border ${cfg.border}`}>
                {cfg.label}
              </span>
            </div>
            <div className="space-y-1">{renderSummary(result.aiSummary)}</div>
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
              <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">
                Signal Radar
              </h3>
              <BotRadarChart signals={result.signals} />
            </div>
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
              <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">
                Signal Scores
              </h3>
              <SignalBarChart signals={result.signals} />
            </div>
          </div>

          {/* Research baselines */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
            <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Research Baselines (Vodra 2025, 52,314 streams)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Organic Chat Ratio", value: "~16.7%", sub: "1 chatter per 6 viewers", ok: true },
                { label: "Botted Chat Ratio", value: "~5.6%", sub: "1 chatter per 18 viewers", ok: false },
                { label: "Bot Prevalence on Twitch", value: "~39.6%", sub: "of reported viewer counts", ok: false },
                { label: "Growth Coupling (organic)", value: "r=0.78", sub: "vs r=0.29 for botted", ok: true },
              ].map(({ label, value, sub, ok }) => (
                <div key={label} className={`rounded-lg p-3 border ${ok ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                  <p className="text-[10px] text-slate-500">{label}</p>
                  <p className={`text-base font-bold ${ok ? "text-green-400" : "text-red-400"}`}>{value}</p>
                  <p className="text-[10px] text-slate-500">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed signals */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-400" />
          Detailed Signal Breakdown ({flaggedCount} flagged)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {result.signals.map(s => <SignalCard key={s.id} signal={s} />)}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
        <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Disclaimer:</strong> This tool uses statistical signals and publicly available data.
          No detection system is 100% accurate. Some legitimate streamers may score higher due to embedded viewing, mobile audiences,
          or external traffic sources. Always consider multiple signals together rather than any single metric.
          Research data sourced from Vodra (2025), TwitchLift, and community-maintained bot databases.
        </p>
      </div>
    </div>
  );
}

// ─── Scanning animation ────────────────────────────────────────────────────────
function ScanningView({ channelName }: { channelName: string }) {
  const steps = [
    { icon: Search, label: "Fetching channel info..." },
    { icon: Eye, label: "Checking live status & viewer count..." },
    { icon: MessageSquare, label: "Analyzing chatter data..." },
    { icon: Bot, label: "Cross-referencing bot databases..." },
    { icon: BarChart2, label: "Calculating signal scores..." },
    { icon: Cpu, label: "Generating analysis..." },
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-8">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-purple-500/40 animate-ping" style={{ animationDelay: "0.3s" }} />
        <div className="w-24 h-24 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
          <Bot className="w-10 h-10 text-purple-400" />
        </div>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white">Scanning <span className="text-purple-400">{channelName}</span></h3>
        <p className="text-sm text-slate-400 mt-1">Analyzing 8 bot-detection signals...</p>
      </div>
      <div className="space-y-2 w-full max-w-sm">
        {steps.map(({ icon: Ic, label }, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-300 ${
              i < step ? "opacity-40" : i === step ? "bg-purple-600/20 border border-purple-500/30" : "opacity-20"
            }`}
          >
            <Ic className={`w-4 h-4 ${i === step ? "text-purple-400" : "text-slate-500"}`} />
            <span className={`text-sm ${i === step ? "text-white" : "text-slate-500"}`}>{label}</span>
            {i < step && <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />}
            {i === step && <div className="ml-auto w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Search form ──────────────────────────────────────────────────────────────
function SearchForm({
  onScan,
  history,
  onHistoryScan,
  onClearHistory,
}: {
  onScan: (name: string) => void;
  history: HistoryEntry[];
  onHistoryScan: (name: string) => void;
  onClearHistory: () => void;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onScan(value.trim());
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-purple-900/30 mb-2">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">
          TwitchBot<span className="text-purple-400">Scan</span>
        </h1>
        <p className="text-slate-400 text-base max-w-lg mx-auto leading-relaxed">
          Advanced viewbot & bot detection powered by <strong className="text-slate-300">8 research-backed signals</strong>.
          Based on 2025 data from 52,314 streams.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {[
            { color: "text-green-400 bg-green-400/10 border-green-400/20", label: "Free & Open Source" },
            { color: "text-purple-400 bg-purple-400/10 border-purple-400/20", label: "No Login Required" },
            { color: "text-blue-400 bg-blue-400/10 border-blue-400/20", label: "Real-Time Analysis" },
          ].map(({ color, label }) => (
            <span key={label} className={`text-xs px-3 py-1 rounded-full border ${color}`}>{label}</span>
          ))}
        </div>
      </div>

      {/* Search box */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
              <span className="text-slate-500 text-sm font-medium">twitch.tv/</span>
            </div>
            <input
              type="text"
              value={value}
              onChange={e => setValue(e.target.value.replace(/^https?:\/\/(www\.)?twitch\.tv\//i, ""))}
              placeholder="channelname"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl pl-[90px] pr-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 text-sm transition-all"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!value.trim()}
            className="px-6 py-3.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all flex items-center gap-2 text-sm"
          >
            <Search className="w-4 h-4" /> Scan
          </button>
        </div>
      </form>

      {/* Feature cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: BarChart2, label: "Chatter Ratio", desc: "Primary signal", color: "text-purple-400" },
          { icon: TrendingUp, label: "Follower Ratio", desc: "Engagement check", color: "text-blue-400" },
          { icon: Bot, label: "Bot Database", desc: "200k+ known bots", color: "text-red-400" },
          { icon: Star, label: "Username Analysis", desc: "Pattern detection", color: "text-amber-400" },
        ].map(({ icon: Ic, label, desc, color }) => (
          <div key={label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center hover:border-slate-600 transition-all">
            <Ic className={`w-5 h-5 ${color} mx-auto mb-2`} />
            <p className="text-xs font-semibold text-slate-200">{label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Recent Scans
            </h3>
            <button onClick={onClearHistory} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Clear
            </button>
          </div>
          <div className="space-y-2">
            {history.map((h, i) => {
              const cfg = RISK_CONFIG[h.riskLevel];
              const Ic = cfg.icon;
              return (
                <button
                  key={i}
                  onClick={() => onHistoryScan(h.channelName)}
                  className="w-full flex items-center gap-3 bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/40 hover:border-slate-600/60 rounded-xl px-4 py-3 text-left transition-all"
                >
                  <Ic className={`w-4 h-4 ${cfg.textColor} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{h.displayName}</p>
                    <p className="text-xs text-slate-500">{timeAgo(h.scanTime)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {h.isLive && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">LIVE</span>
                    )}
                    <span className={`text-xs font-bold ${cfg.textColor}`}>{h.riskScore}/100</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.textColor} border ${cfg.border}`}>
                      {cfg.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Accuracy note */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-1">About Accuracy</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Accuracy is highest when the channel is <strong className="text-slate-400">live</strong>.
              The chatter-to-viewer ratio (organic: ~16.7%, botted: ~5.6%) is the strongest single signal per 2025 research
              covering 52,314 streams. Without live data, confidence drops to ~40%.
              Adding your Twitch API credentials (optional) enables subscriber counts and account age data for even higher accuracy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState<"search" | "scanning" | "result">("search");
  const [scanning, setScanning] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("tbs_history") ?? "[]");
    } catch {
      return [];
    }
  });

  const doScan = useCallback(async (name: string) => {
    setScanning(name);
    setPhase("scanning");
    setError(null);
    try {
      const res = await scanChannel(name);
      setResult(res);
      setPhase("result");
      setHistory(prev => {
        const entry: HistoryEntry = {
          channelName: res.channelName,
          displayName: res.displayName,
          riskLevel: res.riskLevel,
          riskScore: res.riskScore,
          isLive: res.isLive,
          scanTime: res.scanTime,
        };
        const filtered = prev.filter(h => h.channelName !== res.channelName);
        const updated = [entry, ...filtered].slice(0, 8);
        localStorage.setItem("tbs_history", JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
      setPhase("search");
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Gradient bg */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.08)_0%,transparent_60%)] pointer-events-none" />

      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-sm border-b border-slate-800/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-white text-sm">TwitchBotScan</span>
            <span className="text-[10px] bg-purple-600/20 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded font-semibold">
              v2.0
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 hidden sm:block">
              8 signals · Research-backed · 2025
            </span>
            <a
              href="https://github.com/anantapunmagar/TwitchBotScan"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-lg transition-all"
            >
              <GithubIcon /> GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        {error && (
          <div className="max-w-2xl mx-auto mb-6 flex items-start gap-3 bg-red-900/20 border border-red-500/30 rounded-xl p-4">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">Scan Failed</p>
              <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-slate-500 hover:text-slate-300">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {phase === "search" && (
          <SearchForm
            onScan={doScan}
            history={history}
            onHistoryScan={doScan}
            onClearHistory={() => {
              setHistory([]);
              localStorage.removeItem("tbs_history");
            }}
          />
        )}

        {phase === "scanning" && <ScanningView channelName={scanning} />}

        {phase === "result" && result && (
          <ResultsPanel
            result={result}
            onRescan={() => doScan(result.channelName)}
            onNewScan={() => {
              setPhase("search");
              setResult(null);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-20 py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-purple-500" />
            <span>TwitchBotScan v2.0 — Advanced Bot Detection</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Based on Vodra 2025 research · 52,314 streams analyzed</span>
            <a
              href="https://github.com/anantapunmagar/TwitchBotScan"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-slate-400 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
