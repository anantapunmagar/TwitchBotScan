import { motion } from "framer-motion";
import {
  Users, MessageSquare, Heart, Wifi, WifiOff,
  Bot, ShieldCheck, BarChart3, AlertTriangle, RefreshCw,
  Cpu, ExternalLink, Copy, Check
} from "lucide-react";
import { useState } from "react";
import type { ScanResult } from "../types";
import RiskBadge, { riskGradient } from "./RiskBadge";
import RiskMeter from "./RiskMeter";
import MetricBar from "./MetricBar";
import IndicatorCard from "./IndicatorCard";
import RadarChartComponent from "./RadarChart";

interface ScanResultProps {
  result: ScanResult;
  onRescan: () => void;
}

function StatCard({ icon: Icon, label, value, sub, color = "purple" }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    purple: "from-purple-500/10 to-violet-500/5 border-purple-500/20",
    red:    "from-red-500/10 to-rose-500/5 border-red-500/20",
    green:  "from-emerald-500/10 to-teal-500/5 border-emerald-500/20",
    blue:   "from-sky-500/10 to-blue-500/5 border-sky-500/20",
    amber:  "from-amber-500/10 to-orange-500/5 border-amber-500/20",
  };
  const iconColors: Record<string, string> = {
    purple: "text-purple-400", red: "text-red-400", green: "text-emerald-400",
    blue: "text-sky-400", amber: "text-amber-400",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-4 backdrop-blur-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconColors[color]}`} />
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-white font-bold text-xl">{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ScanResultComponent({ result, onRescan }: ScanResultProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "indicators" | "metrics" | "ai">("overview");

  const detectedCount = result.indicators.filter((i) => i.detected).length;
  const grad = riskGradient(result.riskLevel);

  const handleCopy = () => {
    const text = `TwitchBotScan Report: ${result.displayName}\nRisk Score: ${result.riskScore}/100 (${result.riskLevel.toUpperCase()})\nViewers: ${result.viewerCount.toLocaleString()} | Followers: ${result.followerCount.toLocaleString()}\nSuspicious Accounts: ${result.suspiciousAccounts.toLocaleString()}\n\n${result.aiAnalysis}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: "overview",   label: "Overview",   icon: BarChart3 },
    { id: "indicators", label: "Indicators", icon: AlertTriangle },
    { id: "metrics",    label: "Metrics",    icon: Cpu },
    { id: "ai",         label: "AI Analysis",icon: Bot },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto space-y-4"
    >
      {/* ── Channel header card ── */}
      <div className={`relative overflow-hidden bg-gray-900/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl`}>
        {/* Gradient strip */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${grad}`} />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <img
              src={result.avatarUrl}
              alt={result.displayName}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-white/10"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${result.channelName}`;
              }}
            />
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-gray-900 ${result.isLive ? "bg-red-500" : "bg-gray-700"}`}>
              {result.isLive ? <Wifi className="w-2.5 h-2.5 text-white" /> : <WifiOff className="w-2.5 h-2.5 text-white" />}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-white font-bold text-2xl">{result.displayName}</h2>
              <RiskBadge level={result.riskLevel} size="md" />
              {result.isLive && (
                <span className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-2.5 py-1 rounded-full font-semibold">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-gray-500 text-sm">
              <span>{result.isLive ? `Playing ${result.game}` : "Currently Offline"}</span>
              <span className="w-1 h-1 bg-gray-700 rounded-full" />
              <span>Scanned in {(result.scanDuration / 1000).toFixed(1)}s</span>
              <span className="w-1 h-1 bg-gray-700 rounded-full" />
              <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <a
              href={`https://twitch.tv/${result.channelName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 rounded-xl transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Twitch
            </a>
            <button
              onClick={onRescan}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Rescan
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <StatCard icon={Users} label="Viewers" value={result.viewerCount.toLocaleString()} sub={result.isLive ? "live now" : "last live"} color="blue" />
          <StatCard icon={Heart} label="Followers" value={result.followerCount.toLocaleString()} color="purple" />
          <StatCard icon={MessageSquare} label="Chat Rate" value={`${result.chatActivity}/min`} sub={`${result.chatRatio}% active`} color="green" />
          <StatCard icon={AlertTriangle} label="Suspicious" value={result.suspiciousAccounts.toLocaleString()} sub={`of ${result.accountsAnalyzed.toLocaleString()} analyzed`} color={result.riskLevel === "clean" ? "green" : "red"} />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-gray-900/60 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
        {/* Tab bar */}
        <div className="flex border-b border-white/10 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                  active
                    ? "text-purple-400 border-purple-500 bg-purple-500/5"
                    : "text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/3"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.id === "indicators" && detectedCount > 0 && (
                  <span className="ml-1 bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full font-bold">
                    {detectedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-8">
              <div className="flex flex-col items-center justify-center">
                <h3 className="text-gray-400 text-sm font-medium uppercase tracking-widest mb-4">Risk Score</h3>
                <RiskMeter score={result.riskScore} level={result.riskLevel} />

                <div className="mt-6 text-center px-4">
                  <p className="text-gray-400 text-sm">
                    <span className="text-white font-semibold">{detectedCount}</span> of{" "}
                    <span className="text-white font-semibold">{result.indicators.length}</span> bot indicators detected
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-3">
                    {result.indicators.map((ind) => (
                      <div
                        key={ind.id}
                        className={`h-1.5 flex-1 rounded-full ${
                          !ind.detected ? "bg-gray-800" :
                          ind.severity === "danger" ? "bg-red-500" :
                          ind.severity === "warning" ? "bg-amber-500" :
                          "bg-sky-500"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-gray-400 text-sm font-medium uppercase tracking-widest mb-4">Signal Radar</h3>
                <RadarChartComponent metrics={result.metrics} riskLevel={result.riskLevel} />
              </div>
            </motion.div>
          )}

          {/* INDICATORS */}
          {activeTab === "indicators" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> <span className="text-gray-500">Danger</span>
                  <span className="w-2 h-2 rounded-full bg-amber-500 ml-2" /> <span className="text-gray-500">Warning</span>
                  <span className="w-2 h-2 rounded-full bg-sky-500 ml-2" /> <span className="text-gray-500">Info</span>
                </div>
              </div>
              {/* Detected first */}
              {[...result.indicators]
                .sort((a, b) => (b.detected ? 1 : 0) - (a.detected ? 1 : 0))
                .map((ind, i) => (
                  <IndicatorCard key={ind.id} indicator={ind} index={i} />
                ))}
            </motion.div>
          )}

          {/* METRICS */}
          {activeTab === "metrics" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <MetricBar
                label="Chat-to-Viewer Ratio"
                value={result.metrics.viewerChatRatio}
                description="Percentage of viewers actively chatting. Low values suggest passive/bot viewers."
                delay={0.05}
              />
              <MetricBar
                label="Follower/Viewer Consistency"
                value={result.metrics.followerViewerRatio}
                description="Consistency between follower count and live viewer numbers. Mismatches indicate bought views."
                delay={0.1}
              />
              <MetricBar
                label="Chat Velocity Regularity"
                value={result.metrics.chatVelocity}
                description="Regularity of chat message timing. Very uniform patterns may indicate automated bots."
                delay={0.15}
              />
              <MetricBar
                label="Viewer Account Age Score"
                value={result.metrics.accountAge}
                description="Average age of viewer accounts. Very new accounts are a strong viewbot indicator."
                delay={0.2}
              />
              <MetricBar
                label="Overall Engagement Score"
                value={result.metrics.engagementScore}
                description="Combined engagement metric including reactions, follows during stream, and chat quality."
                delay={0.25}
              />
              <MetricBar
                label="Clean Behavior Score"
                value={100 - result.metrics.suspiciousPatterns}
                description="Inverse of suspicious pattern density. Higher = fewer bot patterns detected."
                delay={0.3}
              />
            </motion.div>
          )}

          {/* AI ANALYSIS */}
          {activeTab === "ai" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">AI Analysis</div>
                  <div className="text-gray-500 text-xs">Powered by Groq · llama-3.3-70b-versatile</div>
                </div>
              </div>
              <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {result.aiAnalysis.replace(/\*\*(.*?)\*\*/g, "$1")}
                </p>
              </div>

              {/* Disclaimer */}
              <div className="mt-4 flex items-start gap-2 text-xs text-gray-600">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  This analysis is generated by AI and is for informational purposes only. Bot detection is probabilistic — results may include false positives or false negatives. Always consider the full context before drawing conclusions.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
