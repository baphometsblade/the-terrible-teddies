import { supabase } from '../lib/supabase'

export const setupTerribleTeddies = async () => {
  // Create the terrible_teddies table
  const { error: createError } = await supabase.rpc('create_terrible_teddies_table')
  if (createError) {
    console.error('Error creating terrible_teddies table:', createError)
    return
  }

  // Check if the table is empty
  const { data: existingTeddies, error: checkError } = await supabase
    .from('terrible_teddies')
    .select('id')
    .limit(1)

  if (checkError) {
    console.error('Error checking terrible_teddies table:', checkError)
    return
  }

  // If the table is empty, insert the Terrible Teddies data
  if (existingTeddies.length === 0) {
    const teddiesData = [
      {
        name: "Whiskey Whiskers",
        title: "The Smooth Operator",
        description: "A suave bear with a penchant for fine spirits and even finer company. He's got a twinkle in his eye and a charm that's hard to resist.",
        attack: 6,
        defense: 5,
        special_move: "On the Rocks",
        special_move_description: "Lowers the opponent's defense by 2 with his intoxicating charisma."
      },
      {
        name: "Madame Mistletoe",
        title: "The Festive Flirt",
        description: "She carries mistletoe year-round, believing every moment is an opportunity for a sly kiss. Her playful winks can make hearts skip a beat.",
        attack: 5,
        defense: 6,
        special_move: "Sneak Kiss",
        special_move_description: "Stuns the opponent with a surprise smooch, causing them to skip their next turn."
      },
      // Add the rest of the Terrible Teddies data here
    ]

    const { error: insertError } = await supabase
      .from('terrible_teddies')
      .insert(teddiesData)

    if (insertError) {
      console.error('Error inserting Terrible Teddies data:', insertError)
    } else {
      console.log('Terrible Teddies data uploaded successfully')
    }
  } else {
    console.log('Terrible Teddies table already contains data')
  }

  // Clean up unnecessary tables or data
  const { error: cleanupError } = await supabase.rpc('cleanup_unused_tables')
  if (cleanupError) {
    console.error('Error cleaning up unused tables:', cleanupError)
  } else {
    console.log('Cleanup completed successfully')
  }
}