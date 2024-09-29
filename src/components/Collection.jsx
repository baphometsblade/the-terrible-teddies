import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import { Select } from "@/components/ui/select";

const Collection = () => {
  const [sortBy, setSortBy] = useState('name');

  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('terrible_teddies(*)')
      if (error) throw error;
      return data.map(item => item.terrible_teddies);
    },
  });

  const sortedTeddies = teddies?.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'attack') return b.attack - a.attack;
    if (sortBy === 'defense') return b.defense - a.defense;
    return 0;
  });

  if (isLoading) return <div className="text-center mt-8">Loading your collection...</div>;
  if (error) return <div className="text-center mt-8 text-red-500">Error loading collection: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Your Teddy Collection</h2>
      <div className="mb-4">
        <Select value={sortBy} onValueChange={setSortBy}>
          <Select.Trigger className="w-[180px]">
            <Select.Value placeholder="Sort by..." />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="name">Name</Select.Item>
            <Select.Item value="attack">Attack</Select.Item>
            <Select.Item value="defense">Defense</Select.Item>
          </Select.Content>
        </Select>
      </div>
      {sortedTeddies && sortedTeddies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTeddies.map((teddy) => (
            <TeddyCard key={teddy.id} teddy={teddy} />
          ))}
        </div>
      ) : (
        <p className="text-center">You don't have any teddies yet. Visit the shop to get some!</p>
      )}
    </div>
  );
};

export default Collection;