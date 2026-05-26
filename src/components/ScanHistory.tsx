import { motion, AnimatePresence } from "framer-motion";
import { Clock, Trash2, ChevronRight } from "lucide-react";
import type { ScanHistoryEntry } from "../types";
import RiskBadge from "./RiskBadge";

interface ScanHistoryProps {
  history: ScanHistoryEntry[];
  onSelect: (channelName: string) => void;
  onClear: () => void;
}

export default function ScanHistory({ history, onSelect, onClear }: ScanHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Clock className="w-4 h-4" />
          <span>Recent Scans</span>
          <span className="bg-white/10 text-gray-400 text-xs px-2 py-0.5 rounded-full">{history.length}</span>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {history.map((entry) => (
            <motion.button
              key={entry.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => onSelect(entry.channelName)}
              className="flex items-center gap-2.5 bg-gray-900/60 border border-white/8 hover:border-purple-500/30 hover:bg-purple-500/5 rounded-xl px-3 py-2 transition-all group"
            >
              <div className={`w-2 h-2 rounded-full ${entry.isLive ? "bg-red-500 animate-pulse" : "bg-gray-600"}`} />
              <span className="text-gray-300 text-sm font-medium group-hover:text-white">{entry.channelName}</span>
              <RiskBadge level={entry.riskLevel} size="sm" />
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-purple-400 transition-colors" />
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
