import { Radar, RadarChart as ReRadar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { MetricBreakdown, RiskLevel } from "../types";

interface RadarChartProps {
  metrics: MetricBreakdown;
  riskLevel: RiskLevel;
}

const COLORS: Record<RiskLevel, string> = {
  clean:    "#10b981",
  low:      "#38bdf8",
  medium:   "#f59e0b",
  high:     "#f97316",
  critical: "#ef4444",
};

export default function RadarChartComponent({ metrics, riskLevel }: RadarChartProps) {
  const color = COLORS[riskLevel];

  const data = [
    { subject: "Chat Ratio",     A: metrics.viewerChatRatio,    fullMark: 100 },
    { subject: "Follower/View",  A: metrics.followerViewerRatio, fullMark: 100 },
    { subject: "Chat Speed",     A: metrics.chatVelocity,        fullMark: 100 },
    { subject: "Account Age",    A: metrics.accountAge,          fullMark: 100 },
    { subject: "Engagement",     A: metrics.engagementScore,     fullMark: 100 },
    { subject: "Bot Patterns",   A: 100 - metrics.suspiciousPatterns, fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ReRadar data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="rgba(255,255,255,0.07)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: "#6b7280", fontSize: 11 }}
        />
        <Radar
          name="Score"
          dataKey="A"
          stroke={color}
          fill={color}
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </ReRadar>
    </ResponsiveContainer>
  );
}
