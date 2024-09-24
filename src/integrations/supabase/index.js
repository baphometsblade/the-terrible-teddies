// Import all the relevant exports from other files in the supabase directory
import { supabase } from './supabase.js';
import { SupabaseAuthProvider, useSupabaseAuth, SupabaseAuthUI } from './auth.jsx';

// Import hooks
import {
  useGeneratedImage,
  useGeneratedImages,
  useAddGeneratedImage,
  useUpdateGeneratedImage,
  useDeleteGeneratedImage,
} from './hooks/generated_images';

import {
  useApiRequest,
  useApiRequests,
  useAddApiRequest,
  useUpdateApiRequest,
  useDeleteApiRequest,
} from './hooks/api_requests';

import {
  useCardImage,
  useCardImages,
  useAddCardImage,
  useUpdateCardImage,
  useDeleteCardImage,
} from './hooks/card_images';

import {
  useApiLog,
  useApiLogs,
  useAddApiLog,
  useUpdateApiLog,
  useDeleteApiLog,
} from './hooks/api_logs';

import {
  useUser,
  useUsers,
  useAddUser,
  useUpdateUser,
  useDeleteUser,
} from './hooks/users';

import {
  useApiKey,
  useApiKeys,
  useAddApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
} from './hooks/api_keys';

import {
  useApiResponse,
  useApiResponses,
  useAddApiResponse,
  useUpdateApiResponse,
  useDeleteApiResponse,
} from './hooks/api_responses';

// Export all the imported functions and objects
export {
  supabase,
  SupabaseAuthProvider,
  useSupabaseAuth,
  SupabaseAuthUI,
  useGeneratedImage,
  useGeneratedImages,
  useAddGeneratedImage,
  useUpdateGeneratedImage,
  useDeleteGeneratedImage,
  useApiRequest,
  useApiRequests,
  useAddApiRequest,
  useUpdateApiRequest,
  useDeleteApiRequest,
  useCardImage,
  useCardImages,
  useAddCardImage,
  useUpdateCardImage,
  useDeleteCardImage,
  useApiLog,
  useApiLogs,
  useAddApiLog,
  useUpdateApiLog,
  useDeleteApiLog,
  useUser,
  useUsers,
  useAddUser,
  useUpdateUser,
  useDeleteUser,
  useApiKey,
  useApiKeys,
  useAddApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
  useApiResponse,
  useApiResponses,
  useAddApiResponse,
  useUpdateApiResponse,
  useDeleteApiResponse,
};
