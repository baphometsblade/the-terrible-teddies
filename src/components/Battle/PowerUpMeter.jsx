import React from 'react';
import { Progress } from "@/components/ui/progress";

const PowerUpMeter = ({ value }) => {
  return (
    <div className="w-1/2 pr-2">
      <h4 className="text-sm font-semibold mb-1">Power-Up Meter</h4>
      <Progress value={value} className="w-full" />
    </div>
  );
};

export default PowerUpMeter;