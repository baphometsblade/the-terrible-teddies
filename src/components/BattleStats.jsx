import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const BattleStats = () => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['battleStats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading battle stats...</div>;
  if (error) return <div>Error loading stats: {error.message}</div>;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Battle Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold">Battles Won</h3>
            <p>{stats.battles_won}</p>
          </div>
          <div>
            <h3 className="font-semibold">Battles Lost</h3>
            <p>{stats.battles_lost}</p>
          </div>
          <div>
            <h3 className="font-semibold">Win Rate</h3>
            <Progress value={(stats.battles_won / (stats.battles_won + stats.battles_lost)) * 100} className="mt-2" />
          </div>
          <div>
            <h3 className="font-semibold">Highest Combo</h3>
            <p>{stats.highest_combo}</p>
          </div>
        </div>
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Achievements</h3>
          <ul className="list-disc pl-5">
            {stats.achievements.map((achievement, index) => (
              <li key={index}>{achievement}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default BattleStats;