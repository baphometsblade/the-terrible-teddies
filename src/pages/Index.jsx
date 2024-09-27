import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from '../components/TeddyCard';
import TeddyGenerator from '../components/TeddyGenerator';

const fetchTeddies = async () => {
  const { data, error } = await supabase
    .from('terrible_teddies')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data;
};

const Index = () => {
  const { data: teddies, isLoading, error, refetch } = useQuery({
    queryKey: ['teddies'],
    queryFn: fetchTeddies,
  });

  const handleGenerate = async (newBears) => {
    await refetch();
  };

  if (isLoading) return <div className="text-center mt-8">Loading...</div>;
  if (error) return <div className="text-center mt-8">Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4 text-center text-purple-600">Terrible Teddies</h1>
      <p className="text-center mb-8">Welcome to the cheeky world of battling teddy bears!</p>
      <div className="mb-8 text-center">
        <TeddyGenerator onGenerate={handleGenerate} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {teddies && teddies.map(teddy => (
          <TeddyCard key={teddy.id} teddy={teddy} />
        ))}
      </div>
    </div>
  );
};

export default Index;