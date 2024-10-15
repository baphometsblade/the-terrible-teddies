import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const BattleTimer = ({ duration, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onTimeUp();
    }
  }, [timeLeft, onTimeUp]);

  return (
    <motion.div
      className="battle-timer bg-gray-200 rounded-full h-2 w-full overflow-hidden"
      initial={{ width: '100%' }}
      animate={{ width: `${(timeLeft / duration) * 100}%` }}
      transition={{ duration: 1, ease: 'linear' }}
    >
      <div className="bg-red-500 h-full"></div>
    </motion.div>
  );
};

export default BattleTimer;