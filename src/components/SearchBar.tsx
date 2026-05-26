import { useState } from "react";
import { Search, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";

interface SearchBarProps {
  onScan: (channelName: string) => void;
  isScanning: boolean;
}

const POPULAR_CHANNELS = [
  "shroud", "xqc", "pokimane", "ninja", "hasanabi", "moistcr1tikal", "timthetatman", "summit1g",
];

export default function SearchBar({ onScan, isScanning }: SearchBarProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim().replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "");
    if (trimmed) onScan(trimmed);
  };

  const handleSuggestion = (ch: string) => {
    setValue(ch);
    onScan(ch);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative group">
        {/* Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-violet-600 rounded-2xl opacity-0 group-focus-within:opacity-60 blur transition-opacity duration-500" />

        <div className="relative flex items-center bg-gray-900/80 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
          {/* Twitch icon */}
          <div className="pl-4 pr-2">
            <svg className="w-5 h-5 text-purple-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
          </div>

          {/* Input */}
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter Twitch channel name or URL..."
            disabled={isScanning}
            className="flex-1 bg-transparent py-4 pr-2 text-white placeholder-gray-500 text-base outline-none disabled:opacity-50"
          />

          {/* Clear */}
          {value && !isScanning && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="p-2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!value.trim() || isScanning}
            className="m-1.5 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-500/20"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Scanning...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Scan</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Quick suggestions */}
      {!isScanning && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2 mt-4 justify-center"
        >
          <span className="text-gray-600 text-xs">Try:</span>
          {POPULAR_CHANNELS.map((ch) => (
            <button
              key={ch}
              onClick={() => handleSuggestion(ch)}
              className="text-xs text-gray-400 hover:text-purple-300 bg-white/5 hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/20 px-3 py-1 rounded-full transition-all duration-150"
            >
              {ch}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
