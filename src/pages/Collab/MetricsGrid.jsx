/**
 * MetricsGrid — Display collaboration metrics at a glance
 * Adapted from PixelBrain AnalysisResults
 */

import { motion } from 'framer-motion';
import {
  MetricsIcon,
  ZapIcon,
  LayersIcon,
  GridIcon,
  WarningIcon,
  CheckIcon
} from "../../components/Icons.jsx";

const METRIC_CONFIG = {
  agents: {
    label: 'Total Agents',
    icon: MetricsIcon,
    format: (value) => `${value.online}/${value.total} online`
  },
  tasks: {
    label: 'Active Tasks',
    icon: ZapIcon,
    format: (value) => `${value.active} / ${value.total}`
  },
  pipelines: {
    label: 'Running Pipelines',
    icon: LayersIcon,
    format: (value) => `${value.running} active`
  },
  locks: {
    label: 'File Locks',
    icon: GridIcon,
    format: (value) => `${value.active} locked`
  },
  blocked: {
    label: 'Blocked Items',
    icon: WarningIcon,
    format: (value) => `${value.count} blocked`
  },
  completed: {
    label: 'Completed Today',
    icon: CheckIcon,
    format: (value) => `${value.count} done`
  }
};

export default function MetricsGrid({ metrics }) {
  if (!metrics) return null;

  return (
    <motion.div
      className="metrics-grid"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
    >
      {Object.entries(metrics).map(([key, value]) => {
        const config = METRIC_CONFIG[key];
        if (!config) return null;
        
        const Icon = config.icon;
        
        return (
          <div key={key} className="metric-card">
            <Icon className="metric-icon" />
            <div className="metric-content">
              <span className="metric-label">{config.label}</span>
              <span className="metric-value">
                {config.format(value)}
              </span>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
