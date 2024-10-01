import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { runAllScripts } from '../utils/runAllScripts';

const ScriptRunner = () => {
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const handleRunScripts = async () => {
    setIsRunning(true);
    try {
      const result = await runAllScripts();
      toast({
        title: "Scripts Executed",
        description: result,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Script Runner</h2>
      <Button
        onClick={handleRunScripts}
        disabled={isRunning}
        className="w-full"
      >
        {isRunning ? 'Running Scripts...' : 'Run All Scripts'}
      </Button>
    </div>
  );
};

export default ScriptRunner;