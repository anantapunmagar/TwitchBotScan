import { AlertTriangle, Info, XCircle, CheckCircle } from "lucide-react";
import type { BotIndicator } from "../types";
import { motion } from "framer-motion";

interface IndicatorCardProps {
  indicator: BotIndicator;
  index: number;
}

const SEVERITY = {
  info:    { icon: Info,          bg: "bg-sky-500/10",    border: "border-sky-500/20",    text: "text-sky-400",    label: "INFO" },
  warning: { icon: AlertTriangle, bg: "bg-amber-500/10",  border: "border-amber-500/20",  text: "text-amber-400",  label: "WARN" },
  danger:  { icon: XCircle,       bg: "bg-red-500/10",    border: "border-red-500/20",    text: "text-red-400",    label: "DANGER" },
};

export default function IndicatorCard({ indicator, index }: IndicatorCardProps) {
  const s = SEVERITY[indicator.severity];
  const Icon = s.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`relative p-4 rounded-2xl border backdrop-blur-sm transition-all duration-200 ${
        indicator.detected
          ? `${s.bg} ${s.border}`
          : "bg-white/3 border-white/5 opacity-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 mt-0.5 ${indicator.detected ? s.text : "text-gray-600"}`}>
          {indicator.detected ? (
            <Icon className="w-5 h-5" />
          ) : (
            <CheckCircle className="w-5 h-5 text-gray-600" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${indicator.detected ? "text-white" : "text-gray-500"}`}>
              {indicator.name}
            </span>
            {indicator.detected && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${s.bg} ${s.text} border ${s.border}`}>
                {s.label}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-1 leading-relaxed">{indicator.description}</p>
          {indicator.value && indicator.detected && (
            <div className={`mt-2 text-xs font-mono font-semibold ${s.text}`}>
              → {indicator.value}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
