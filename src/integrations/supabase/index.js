import { createClient } from '@supabase/supabase-js';
import { S3Client } from '@aws-sdk/client-s3';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTerribleTeddiesCards } from './queries/terribleTeddiesCards';
import { useGeneratedImages, useAddGeneratedImage } from './queries/generatedImages';
import { useUserDeck } from './queries/userDeck';
import { useUpdateUserStats, useUserStats } from './queries/userStats';
import { useEvolveCard } from './mutations/evolveCard';
import { useCurrentUser, useSupabaseAuth, SupabaseAuthProvider as SupabaseProvider } from './auth.jsx';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const createAuthenticatedS3Client = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('No active session found');
  }

  return new S3Client({
    forcePathStyle: true,
    region: import.meta.env.VITE_SUPABASE_REGION,
    endpoint: `${supabaseUrl}/storage/v1/s3`,
    credentials: {
      accessKeyId: import.meta.env.VITE_SUPABASE_PROJECT_REF,
      secretAccessKey: supabaseKey,
      sessionToken: session.access_token,
    },
  });
};

export {
  useTerribleTeddiesCards,
  useGeneratedImages,
  useAddGeneratedImage,
  useUserDeck,
  useUpdateUserStats,
  useUserStats,
  useEvolveCard,
  useCurrentUser,
  useSupabaseAuth,
  SupabaseProvider,
};
