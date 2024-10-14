import React from 'react';
import { Progress } from "@/components/ui/progress";

const ComboMeter = ({ value }) => {
  return (
    <div className="w-1/2 pl-2">
      <h4 className="text-sm font-semibold mb-1">Combo Meter</h4>
      <Progress value={value} className="w-full" />
    </div>
  );
};

export default ComboMeter;