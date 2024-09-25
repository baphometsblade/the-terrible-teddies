import { supabase } from '../lib/supabase';

export async function createTeddyBear(bearData) {
  const { data, error } = await supabase
    .from('teddy_bears')
    .insert([bearData]);

  if (error) {
    console.error('Error creating teddy bear:', error);
    return null;
  }
  return data[0];
}

export async function getTeddyBear(bearId) {
  const { data, error } = await supabase
    .from('teddy_bears')
    .select('*')
    .eq('id', bearId)
    .single();

  if (error) {
    console.error('Error fetching teddy bear:', error);
    return null;
  }
  return data;
}

export async function updateTeddyBear(bearId, updateData) {
  const { data, error } = await supabase
    .from('teddy_bears')
    .update(updateData)
    .eq('id', bearId);

  if (error) {
    console.error('Error updating teddy bear:', error);
    return null;
  }
  return data[0];
}

export async function deleteTeddyBear(bearId) {
  const { error } = await supabase
    .from('teddy_bears')
    .delete()
    .eq('id', bearId);

  if (error) {
    console.error('Error deleting teddy bear:', error);
    return false;
  }
  return true;
}