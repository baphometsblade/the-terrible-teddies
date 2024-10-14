import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';
import SeasonalEventShop from './SeasonalEventShop';

const SeasonalEvent = () => {
  const [participation, setParticipation] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const { toast } = useToast();

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['seasonalEvent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasonal_events')
        .select('*')
        .eq('is_active', true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const participateMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('event_participants')
        .insert({ user_id: user.id, event_id: event.id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setParticipation(true);
      toast({
        title: "Participation Confirmed",
        description: "You've successfully joined the seasonal event!",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Participation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const checkParticipation = async () => {
      if (event) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('event_participants')
          .select('*')
          .eq('user_id', user.id)
          .eq('event_id', event.id)
          .single();
        if (data) setParticipation(true);
      }
    };
    checkParticipation();
  }, [event]);

  if (isLoading) return <div>Loading seasonal event...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!event) return <div>No active seasonal event at the moment.</div>;

  return (
    <motion.div 
      className="seasonal-event p-4 bg-gray-100 rounded-lg"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4">{event.name}</h2>
      <p className="mb-4">{event.description}</p>
      <p className="mb-4">Event ends: {new Date(event.end_date).toLocaleDateString()}</p>
      {!participation ? (
        <Button 
          onClick={() => participateMutation.mutate()}
          disabled={participateMutation.isLoading}
        >
          {participateMutation.isLoading ? 'Joining...' : 'Join Event'}
        </Button>
      ) : (
        <>
          <p className="text-green-500 font-bold mb-4">You're participating in this event!</p>
          <Button onClick={() => setShowShop(!showShop)} className="mb-4">
            {showShop ? 'Hide Event Shop' : 'Show Event Shop'}
          </Button>
          {showShop && <SeasonalEventShop eventId={event.id} />}
        </>
      )}
    </motion.div>
  );
};

export default SeasonalEvent;