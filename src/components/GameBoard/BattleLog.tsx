import React from 'react';

interface BattleLogProps {
  logs: string[];
}

const BattleLog: React.FC<BattleLogProps> = ({ logs }) => {
  return (
    <div className="battle-log">
      <h3>Battle Log</h3>
      <div className="log-entries">
        {logs.map((log, index) => (
          <div key={index} className="log-entry">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BattleLog;