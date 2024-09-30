import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { runAllScripts } from '../utils/runAllScripts';
import { useToast } from "@/components/ui/use-toast";

const Home = () => {
  const [isRunningScripts, setIsRunningScripts] = useState(false);
  const { toast } = useToast();

  const handleRunScripts = async () => {
    setIsRunningScripts(true);
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
        description: `Failed to run scripts: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsRunningScripts(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Welcome to Terrible Teddies</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link to="/game">
          <Button className="w-full">Battle Arena</Button>
        </Link>
        <Link to="/collection">
          <Button className="w-full">My Teddy Collection</Button>
        </Link>
        <Link to="/shop">
          <Button className="w-full">Teddy Shop</Button>
        </Link>
        <Link to="/leaderboard">
          <Button className="w-full">Leaderboard</Button>
        </Link>
      </div>
      <Button 
        className="w-full bg-purple-600 hover:bg-purple-700"
        onClick={handleRunScripts}
        disabled={isRunningScripts}
      >
        {isRunningScripts ? 'Running Scripts...' : 'Run All Scripts'}
      </Button>
    </div>
  );
};

export default Home;