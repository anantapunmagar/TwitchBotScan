import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shield, Bot, Zap, Lock } from "lucide-react";
import SearchBar from "./components/SearchBar";
import ScanProgress from "./components/ScanProgress";
import ScanResultComponent from "./components/ScanResult";
import ScanHistory from "./components/ScanHistory";
import type { ScanResult, ScanHistoryEntry } from "./types";
import { scanChannel } from "./utils/scanner";

const STORAGE_KEY_HIST = "twitch-scan-history";

function loadHistory(): ScanHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HIST);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((e: ScanHistoryEntry) => ({ ...e, timestamp: new Date(e.timestamp) }));
  } catch {
    return [];
  }
}

function BgGlow() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-violet-600/8 rounded-full blur-[100px]" />
      <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-indigo-600/6 rounded-full blur-[80px]" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full max-w-2xl mx-auto bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 flex items-start gap-3"
    >
      <div className="flex-1">
        <p className="text-red-300 text-sm font-medium">Scan Failed</p>
        <p className="text-red-400/70 text-xs mt-0.5">{message}</p>
      </div>
      <button onClick={onDismiss} className="text-red-500 hover:text-red-300 text-lg leading-none">x</button>
    </motion.div>
  );
}

const FEATURES = [
  { icon: Shield, title: "8 Bot Indicators", desc: "Detects low chat ratios, suspicious usernames, new account clustering, IP patterns, and more." },
  { icon: Bot,    title: "AI-Powered Analysis", desc: "Uses Groq's llama-3.3-70b to generate human-readable bot detection summaries." },
  { icon: Zap,    title: "Visual Metrics", desc: "Interactive radar chart, risk gauge, and metric breakdowns for deep analysis." },
  { icon: Lock,   title: "Privacy First", desc: "All analysis runs server-side. No user data is stored or shared." },
];

export default function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanningChannel, setScanningChannel] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>(loadHistory);

  const handleScan = useCallback(async (channelName: string) => {
    if (!channelName.trim()) return;
    setIsScanning(true);
    setScanningChannel(channelName.trim());
    setResult(null);
    setError(null);

    try {
      const res = await scanChannel(channelName.trim());
      setResult(res);

      const entry: ScanHistoryEntry = {
        id: `${channelName}-${Date.now()}`,
        channelName: res.channelName,
        riskLevel: res.riskLevel,
        riskScore: res.riskScore,
        timestamp: res.timestamp,
        isLive: res.isLive,
      };
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.channelName !== res.channelName);
        const updated = [entry, ...filtered].slice(0, 8);
        localStorage.setItem(STORAGE_KEY_HIST, JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleRescan = useCallback(() => {
    if (result) handleScan(result.channelName);
  }, [result, handleScan]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY_HIST);
  }, []);

  const handleNewScan = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 font-['Inter',sans-serif] relative">
      <BgGlow />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <AnimatePresence mode="wait">
          {!result && !isScanning && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center"
            >
              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-10"
              >
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white font-black text-2xl tracking-tight">
                    Twitch<span className="text-purple-400">Scan</span>
                  </span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mb-4">
                  Detect Twitch{" "}
                  <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
                    Viewbots
                  </span>
                  <br />
                  <span className="text-gray-400 text-3xl sm:text-4xl font-bold">in Seconds</span>
                </h1>

                <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
                  AI-powered stream authenticity analyzer. Scan any Twitch channel for fake viewers, bot accounts, and engagement manipulation.
                </p>
              </motion.div>

              <div className="w-full mb-8">
                <SearchBar onScan={handleScan} isScanning={isScanning} />
              </div>

              <AnimatePresence>
                {error && (
                  <div className="w-full mb-6">
                    <ErrorBanner message={error} onDismiss={() => setError(null)} />
                  </div>
                )}
              </AnimatePresence>

              <ScanHistory
                history={history}
                onSelect={handleScan}
                onClear={handleClearHistory}
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid sm:grid-cols-4 gap-4 mt-16 w-full max-w-4xl"
              >
                {FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className="bg-gray-900/50 border border-white/8 rounded-2xl p-5 backdrop-blur-sm hover:border-purple-500/20 hover:bg-purple-500/3 transition-all duration-300"
                  >
                    <f.icon className="w-5 h-5 text-purple-400 mb-3" />
                    <h3 className="text-white font-semibold text-sm mb-1.5">{f.title}</h3>
                    <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {isScanning && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <ScanProgress channel={scanningChannel} />
            </motion.div>
          )}

          {result && !isScanning && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="w-full max-w-4xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <button
                    onClick={handleNewScan}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-purple-300 transition-colors group"
                  >
                    <span className="text-xl group-hover:-translate-x-1 transition-transform inline-block">←</span>
                    New Scan
                  </button>
                  <div className="flex-1 sm:max-w-md">
                    <SearchBar onScan={handleScan} isScanning={isScanning} />
                  </div>
                </div>
              </div>

              <ScanResultComponent result={result} onRescan={handleRescan} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 border-t border-white/5 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-purple-500 font-bold text-sm">TwitchScan</span>
          <div className="flex items-center gap-4 text-gray-700 text-xs">
            <span>Powered by Groq AI</span>
            <span>·</span>
            <span>Twitch Helix API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
