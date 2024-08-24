import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '../integrations/supabase';
import { useCurrentUser } from '../integrations/supabase/auth';
import { GameBoard } from './GameBoard';

const Multiplayer = ({ onExit }) => {
  const [games, setGames] = useState([]);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isJoiningGame, setIsJoiningGame] = useState(false);
  const [currentGame, setCurrentGame] = useState(null);
  const { data: currentUser } = useCurrentUser();
  const { toast } = useToast();

  useEffect(() => {
    fetchGames();
    const subscription = supabase
      .channel('public:games')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, fetchGames)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchGames = async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching games:', error);
    } else {
      setGames(data);
    }
  };

  const createGame = async () => {
    setIsCreatingGame(true);
    const { data, error } = await supabase
      .from('games')
      .insert({
        host_id: currentUser.id,
        status: 'waiting',
      })
      .select()
      .single();

    setIsCreatingGame(false);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to create game. Please try again.",
        variant: "destructive",
      });
    } else {
      setCurrentGame(data);
    }
  };

  const joinGame = async (gameId) => {
    setIsJoiningGame(true);
    const { data, error } = await supabase
      .from('games')
      .update({ guest_id: currentUser.id, status: 'in_progress' })
      .eq('id', gameId)
      .select()
      .single();

    setIsJoiningGame(false);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to join game. Please try again.",
        variant: "destructive",
      });
    } else {
      setCurrentGame(data);
    }
  };

  if (currentGame) {
    return <GameBoard gameId={currentGame.id} onExit={() => setCurrentGame(null)} />;
  }

  return (
    <div className="multiplayer-container p-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold mb-6 text-center text-purple-800">Multiplayer</h2>
      <div className="mb-6">
        <Button onClick={createGame} disabled={isCreatingGame} className="w-full bg-green-500 hover:bg-green-600 text-white">
          {isCreatingGame ? "Creating Game..." : "Create New Game"}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {games.map((game) => (
          <Card key={game.id} className="bg-white shadow-md">
            <CardContent className="p-4">
              <p className="font-semibold mb-2">Game #{game.id}</p>
              <p className="text-sm mb-4">Created by: {game.host_id}</p>
              <Button onClick={() => joinGame(game.id)} disabled={isJoiningGame} className="w-full bg-blue-500 hover:bg-blue-600 text-white">
                Join Game
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button onClick={onExit} className="mt-6 bg-gray-500 hover:bg-gray-600 text-white">
        Back to Menu
      </Button>
    </div>
  );
};

export default Multiplayer;