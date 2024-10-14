import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageOff } from 'lucide-react';

const TeddyDisplay = ({ onSelect }) => {
  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['teddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-center p-8">Loading teddies...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error loading teddies: {error.message}</div>;

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Your Terrible Teddies</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teddies.map(teddy => (
          <Card key={teddy.id} className="overflow-hidden">
            <div className="relative h-48 bg-gray-200">
              {teddy.imageUrl ? (
                <img 
                  src={teddy.imageUrl} 
                  alt={teddy.name} 
                  className="absolute inset-0 w-full h-full object-cover transform hover:scale-110 transition-transform duration-300 ease-in-out"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/300x200?text=Image+Not+Available';
                  }}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <ImageOff className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-50"></div>
              <h3 className="absolute bottom-2 left-2 text-white text-xl font-semibold">{teddy.name}</h3>
            </div>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-2">{teddy.title}</p>
              <p className="text-sm mb-2">{teddy.description}</p>
              <div className="flex justify-between text-sm">
                <span><strong>Attack:</strong> {teddy.attack}</span>
                <span><strong>Defense:</strong> {teddy.defense}</span>
              </div>
              <p className="mt-2 text-sm"><strong>Special Move:</strong> {teddy.special_move}</p>
              <Button onClick={() => onSelect(teddy)} className="mt-4 w-full">
                Select
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TeddyDisplay;