import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Shield, Users, MessageSquare, Database, Brain, CheckCircle } from "lucide-react";

const STEPS = [
  { icon: Shield,       label: "Connecting to Twitch API",     duration: 600 },
  { icon: Users,        label: "Fetching viewer list",          duration: 800 },
  { icon: Database,     label: "Analyzing account ages",        duration: 700 },
  { icon: MessageSquare,label: "Processing chat patterns",      duration: 900 },
  { icon: Brain,        label: "Running AI analysis",           duration: 1000 },
  { icon: CheckCircle,  label: "Compiling scan report",         duration: 400 },
];

interface ScanProgressProps {
  channel: string;
}

export default function ScanProgress({ channel }: ScanProgressProps) {
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    let idx = 0;
    const advance = () => {
      if (idx < STEPS.length - 1) {
        idx++;
        setStep(idx);
        setTimeout(advance, STEPS[idx].duration);
      }
    };
    setTimeout(advance, STEPS[0].duration);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 400);
    return () => clearInterval(t);
  }, []);

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="bg-gray-900/70 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
        {/* Channel info */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center shadow-xl shadow-purple-500/30 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-white font-bold text-xl">Scanning <span className="text-purple-400">{channel}</span></h2>
          <p className="text-gray-500 text-sm mt-1">Deep bot detection analysis{dots}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Progress</span>
            <span className="text-purple-400 font-mono">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-600 to-violet-500 rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2.5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: i <= step ? 1 : 0.3, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${
                  active ? "bg-purple-500/10 border border-purple-500/20" : done ? "bg-white/3" : ""
                }`}
              >
                <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                  done ? "bg-emerald-500/20 text-emerald-400" :
                  active ? "bg-purple-500/20 text-purple-400" :
                  "bg-gray-800 text-gray-600"
                }`}>
                  {done ? <CheckCircle className="w-4 h-4" /> : <Icon className={`w-4 h-4 ${active ? "animate-pulse" : ""}`} />}
                </div>
                <span className={`text-sm font-medium ${
                  done ? "text-emerald-400" : active ? "text-white" : "text-gray-600"
                }`}>
                  {s.label}
                  {active && <span className="text-purple-400">{dots}</span>}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
