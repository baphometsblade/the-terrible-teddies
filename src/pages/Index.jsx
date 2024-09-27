import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, initializeSupabase } from '../lib/supabase';
import TeddyCard from '../components/TeddyCard';
import TeddyGenerator from '../components/TeddyGenerator';

const fetchTeddies = async () => {
  console.log('Fetching teddies...');
  try {
    const { data, error } = await supabase
      .from('terrible_teddies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Fetched teddies:', data);
    return data;
  } catch (error) {
    console.error('Error in fetchTeddies:', error);
    throw error;
  }
};

const Index = () => {
  const [isSupabaseInitialized, setIsSupabaseInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      const initialized = await initializeSupabase();
      setIsSupabaseInitialized(initialized);
    };
    init();
  }, []);

  const { data: teddies, isLoading, error, refetch } = useQuery({
    queryKey: ['teddies'],
    queryFn: fetchTeddies,
    enabled: isSupabaseInitialized,
  });

  console.log('Query state:', { isLoading, error, teddiesCount: teddies?.length });

  const handleGenerate = async () => {
    console.log('Generate button clicked');
    await refetch();
  };

  if (!isSupabaseInitialized) {
    return <div className="text-center mt-8">Initializing Supabase...</div>;
  }

  if (isLoading) {
    console.log('Loading teddies...');
    return <div className="text-center mt-8">Loading...</div>;
  }
  
  if (error) {
    console.error('Error in Index component:', error);
    return <div className="text-center mt-8">Error: {error.message}</div>;
  }

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