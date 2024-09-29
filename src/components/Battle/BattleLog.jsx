import React from 'react';

const BattleLog = ({ log }) => {
  return (
    <div>
      <h3 className="text-lg font-bold mb-2">Battle Log</h3>
      <ul className="list-disc list-inside">
        {log.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ul>
    </div>
  );
};

export default BattleLog;