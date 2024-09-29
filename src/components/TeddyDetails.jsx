import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const TeddyDetails = () => {
  const { id } = useParams();

  const { data: teddy, isLoading, error } = useQuery({
    queryKey: ['teddy', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-center mt-8">Loading teddy details...</div>;
  if (error) return <div className="text-center mt-8 text-red-500">Error loading teddy details: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <h2 className="text-2xl font-bold">{teddy.name}</h2>
          <p className="text-gray-500">{teddy.title}</p>
        </CardHeader>
        <CardContent>
          <img src={teddy.image_url} alt={teddy.name} className="w-full h-64 object-cover rounded-lg mb-4" />
          <p className="mb-2">{teddy.description}</p>
          <p className="mb-2">Attack: {teddy.attack}</p>
          <p className="mb-2">Defense: {teddy.defense}</p>
          <p className="mb-2">Special Move: {teddy.special_move}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeddyDetails;