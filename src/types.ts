export type RiskLevel = "clean" | "low" | "medium" | "high" | "critical";

export interface ScanResult {
  channelName: string;
  displayName: string;
  avatarUrl: string;
  isLive: boolean;
  game: string;
  viewerCount: number;
  followerCount: number;
  chatActivity: number;
  riskScore: number;
  riskLevel: RiskLevel;
  indicators: BotIndicator[];
  chatRatio: number;
  suspiciousAccounts: number;
  accountsAnalyzed: number;
  scanDuration: number;
  timestamp: Date;
  aiAnalysis: string;
  metrics: MetricBreakdown;
}

export interface BotIndicator {
  id: string;
  name: string;
  severity: "info" | "warning" | "danger";
  description: string;
  detected: boolean;
  value?: string | number;
}

export interface MetricBreakdown {
  viewerChatRatio: number;
  followerViewerRatio: number;
  chatVelocity: number;
  accountAge: number;
  engagementScore: number;
  suspiciousPatterns: number;
}

export interface ScanHistoryEntry {
  id: string;
  channelName: string;
  riskLevel: RiskLevel;
  riskScore: number;
  timestamp: Date;
  isLive: boolean;
}
