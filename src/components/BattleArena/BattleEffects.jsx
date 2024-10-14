import React from 'react';

const BattleEffects = ({ effect }) => {
  if (!effect) return null;

  return (
    <div className="battle-effects">
      <h3 className="text-lg font-semibold">{effect.name}</h3>
      <p>{effect.description}</p>
    </div>
  );
};

export default BattleEffects;