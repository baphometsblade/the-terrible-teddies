import { supabase } from '../lib/supabase';

export async function purchaseItem(playerId, cosmeticId) {
  const { data: itemData, error: itemError } = await supabase
    .from('cosmetic_items')
    .select('price')
    .eq('id', cosmeticId)
    .single();

  if (itemError) {
    console.error('Error fetching item:', itemError);
    return false;
  }

  const { data: playerData, error: playerError } = await supabase
    .from('players')
    .select('coins')
    .eq('id', playerId)
    .single();

  if (playerError) {
    console.error('Error fetching player data:', playerError);
    return false;
  }

  if (playerData.coins >= itemData.price) {
    const { error: updateError } = await supabase
      .from('players')
      .update({ coins: playerData.coins - itemData.price })
      .eq('id', playerId);

    if (updateError) {
      console.error('Error updating player coins:', updateError);
      return false;
    }

    const { error: insertError } = await supabase
      .from('player_cosmetics')
      .insert([{ player_id: playerId, cosmetic_id: cosmeticId, equipped: false }]);

    if (insertError) {
      console.error('Error adding cosmetic to player:', insertError);
      return false;
    }

    return true;
  }

  return false;
}

export async function equipItem(playerId, cosmeticId) {
  await supabase
    .from('player_cosmetics')
    .update({ equipped: false })
    .eq('player_id', playerId);

  const { error } = await supabase
    .from('player_cosmetics')
    .update({ equipped: true })
    .eq('player_id', playerId)
    .eq('cosmetic_id', cosmeticId);

  if (error) {
    console.error('Error equipping item:', error);
    return false;
  }

  return true;
}