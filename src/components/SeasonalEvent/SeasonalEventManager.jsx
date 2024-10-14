import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from '../TeddyCard';

const SeasonalEventManager = () => {
  const [currentEvent, setCurrentEvent] = useState(null);
  const { toast } = useToast();

  const { data: eventData, isLoading, error } = useQuery({
    queryKey: ['currentSeasonalEvent'],
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

  useEffect(() => {
    if (eventData) {
      setCurrentEvent(eventData);
    }
  }, [eventData]);

  const participateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('player_event_participation')
        .insert({ event_id: currentEvent.id, player_id: supabase.auth.user().id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Event Joined!",
        description: `You've successfully joined the ${currentEvent.name} event!`,
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to join event: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <div>Loading event data...</div>;
  if (error) return <div>Error loading event: {error.message}</div>;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{currentEvent ? currentEvent.name : "No Active Event"}</CardTitle>
      </CardHeader>
      <CardContent>
        {currentEvent ? (
          <>
            <p className="mb-4">{currentEvent.description}</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {currentEvent.reward_teddies && currentEvent.reward_teddies.map((teddy, index) => (
                <TeddyCard key={index} teddy={teddy} />
              ))}
            </div>
            <Button onClick={() => participateMutation.mutate()}>
              Participate in Event
            </Button>
          </>
        ) : (
          <p>There are no active seasonal events at the moment. Check back later!</p>
        )}
      </CardContent>
    </Card>
  );
};

export default SeasonalEventManager;