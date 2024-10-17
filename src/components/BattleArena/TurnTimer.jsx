import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";

const TurnTimer = ({ isPlayerTurn, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (isPlayerTurn) {
      const timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timer);
            onTimeUp();
            return 30;
          }
          return prevTime - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setTimeLeft(30);
    }
  }, [isPlayerTurn, onTimeUp]);

  return (
    <div className="turn-timer mt-4">
      <h3 className="text-lg font-semibold mb-2">Turn Timer</h3>
      <Progress value={(timeLeft / 30) * 100} className="w-full" />
      <p className="text-center mt-2">{timeLeft}s</p>
    </div>
  );
};

export default TurnTimer;