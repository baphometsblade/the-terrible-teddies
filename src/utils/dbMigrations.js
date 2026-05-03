import { supabase } from '../lib/supabase';

export const runMigrations = async () => {
  const migrations = [
    createTableIfNotExists,
    createPolicyIfNotExists
  ];

  for (const migration of migrations) {
    await migration();
  }
};

const createTableIfNotExists = async () => {
  const { error } = await supabase.rpc('create_function_create_table_if_not_exists');
  if (error) throw new Error(`Error creating create_table_if_not_exists function: ${error.message}`);
};

const createPolicyIfNotExists = async () => {
  const { error } = await supabase.rpc('create_function_create_policy_if_not_exists');
  if (error) throw new Error(`Error creating create_policy_if_not_exists function: ${error.message}`);
};

export const verifyTables = async () => {
  const tables = ['terrible_teddies', 'players', 'player_teddies', 'battles', 'player_submissions'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('count')
      .limit(1);
    
    if (error) {
      console.error(`Error verifying ${table} table:`, error);
      return false;
    }
  }
  
  return true;
};