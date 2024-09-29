import { supabase } from '../../lib/supabase';
import fs from 'fs';
import path from 'path';

export const runPublicFunctions = async () => {
  const sqlContent = fs.readFileSync(path.join(__dirname, '011_create_public_functions.sql'), 'utf8');
  
  const { error } = await supabase.rpc('run_sql_migration', { sql: sqlContent });
  
  if (error) {
    console.error('Error creating public functions:', error);
    throw error;
  }
  
  console.log('Public functions created successfully');
};

export default runPublicFunctions;