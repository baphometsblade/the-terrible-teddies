import React from 'react';
import { Button } from "@/components/ui/button";

interface Combo {
  id: string;
  name: string;
  description: string;
  requiredCards: string[];
}

interface ComboSystemProps {
  availableCombos: Combo[];
  onUseCombo: (combo: Combo) => void;
}

const ComboSystem: React.FC<ComboSystemProps> = ({ availableCombos, onUseCombo }) => {
  return (
    <div className="combo-system">
      <h3>Available Combos</h3>
      <div className="combo-list">
        {availableCombos.map((combo) => (
          <Button
            key={combo.id}
            onClick={() => onUseCombo(combo)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            {combo.name}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default ComboSystem;