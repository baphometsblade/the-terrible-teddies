import React from 'react';

const BattleLog = ({ log }) => {
  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-bold mb-2">Battle Log</h3>
      <ul className="list-disc list-inside">
        {log.map((entry, index) => (
          <li key={index} className="text-sm">{entry}</li>
        ))}
      </ul>
    </div>
  );
};

export default BattleLog;