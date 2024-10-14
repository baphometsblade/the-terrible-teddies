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
      className="battle-timer bg-gray-200 p-2 rounded-full w-20 h-20 flex items-center justify-center"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <motion.div
        className="text-2xl font-bold"
        key={timeLeft}
        initial={{ scale: 1.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {timeLeft}
      </motion.div>
    </motion.div>
  );
};

export default BattleTimer;