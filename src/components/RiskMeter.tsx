import { motion } from "framer-motion";
import type { RiskLevel } from "../types";
import { riskGradient } from "./RiskBadge";

interface RiskMeterProps {
  score: number;
  level: RiskLevel;
}

export default function RiskMeter({ score, level }: RiskMeterProps) {
  const grad = riskGradient(level);
  const angle = (score / 100) * 180 - 90; // -90 to +90 degrees

  return (
    <div className="flex flex-col items-center">
      {/* Gauge */}
      <div className="relative w-48 h-24 overflow-hidden">
        {/* Background arc */}
        <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full">
          {/* Track */}
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="20"
            strokeLinecap="round"
          />
          {/* Colored fill - approximate with gradient overlay */}
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="40%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <clipPath id="gaugeClip">
              <rect x="0" y="0" width={200 * (score / 100)} height="200" />
            </clipPath>
          </defs>
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="20"
            strokeLinecap="round"
            clipPath="url(#gaugeClip)"
          />
          {/* Needle */}
          <g transform={`translate(100, 100) rotate(${angle})`}>
            <line x1="0" y1="0" x2="0" y2="-72" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="0" cy="0" r="5" fill="white" />
          </g>
        </svg>
      </div>

      {/* Score label */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring" }}
        className="text-center -mt-2"
      >
        <div className={`text-5xl font-black bg-gradient-to-r ${grad} bg-clip-text text-transparent`}>
          {score}
        </div>
        <div className="text-gray-500 text-xs font-medium mt-0.5">Risk Score / 100</div>
      </motion.div>
    </div>
  );
}
