import { motion } from "framer-motion";

interface MetricBarProps {
  label: string;
  value: number;
  description: string;
  invertColor?: boolean; // true = high value = bad
  delay?: number;
}

export default function MetricBar({ label, value, description, invertColor = false, delay = 0 }: MetricBarProps) {
  const effectiveVal = invertColor ? 100 - value : value;
  const color =
    effectiveVal >= 70 ? "from-emerald-500 to-teal-500" :
    effectiveVal >= 40 ? "from-amber-500 to-orange-500" :
    "from-red-500 to-rose-600";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-gray-300 text-sm font-medium">{label}</span>
        <span className="text-gray-400 text-sm font-mono">{value}%</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${color} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, delay, ease: "easeOut" }}
        />
      </div>
      <p className="text-gray-600 text-xs mt-1">{description}</p>
    </div>
  );
}
