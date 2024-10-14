import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';

const SeasonalEventShop = ({ eventId }) => {
  const { toast } = useToast();

  const { data: items, isLoading, error } = useQuery({
    queryKey: ['seasonalEventItems', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasonal_event_items')
        .select('*')
        .eq('event_id', eventId);
      if (error) throw error;
      return data;
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (itemId) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc('purchase_seasonal_item', {
        p_user_id: user.id,
        p_item_id: itemId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Purchase Successful",
        description: `You've acquired a new seasonal item!`,
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <div>Loading seasonal items...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <motion.div 
      className="seasonal-event-shop p-4 bg-gray-100 rounded-lg"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4">Seasonal Event Shop</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold">{item.name}</h3>
            <p className="text-gray-600">{item.description}</p>
            <p className="text-yellow-600 font-bold mt-2">Price: {item.price} coins</p>
            <Button 
              onClick={() => purchaseMutation.mutate(item.id)}
              disabled={purchaseMutation.isLoading}
              className="mt-2 w-full"
            >
              {purchaseMutation.isLoading ? 'Purchasing...' : 'Purchase'}
            </Button>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default SeasonalEventShop;