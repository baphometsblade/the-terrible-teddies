import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export const MomentumGauge = ({ value }) => (
  <div className="flex items-center space-x-2">
    <Zap className="w-6 h-6 text-yellow-500" />
    <div className="flex-grow">
      <Progress value={(value / 10) * 100} className="h-4 bg-yellow-200" />
    </div>
    <motion.span
      key={value}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="text-lg font-bold text-yellow-600"
    >
      {value}/10
    </motion.span>
  </div>
);