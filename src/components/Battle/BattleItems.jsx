import React from 'react';
import { Button } from "@/components/ui/button";

const BattleItems = ({ items, onUseItem }) => {
  return (
    <div className="battle-items mt-4">
      <h3 className="text-lg font-semibold mb-2">Battle Items</h3>
      <div className="flex space-x-2">
        {items.map((item, index) => (
          <Button
            key={index}
            onClick={() => onUseItem(index)}
            className="px-2 py-1 text-sm"
          >
            {item.name}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default BattleItems;