import { supabase } from '../lib/supabase';

export const setupDatabase = async () => {
  const migrations = [
    {
      name: '001_create_tables',
      sql: await import('../db/migrations/001_create_tables.sql?raw')
    },
    {
      name: '002_create_player_teddies',
      sql: await import('../db/migrations/002_create_player_teddies.sql?raw')
    },
    {
      name: '003_create_terrible_teddies',
      sql: await import('../db/migrations/003_create_terrible_teddies.sql?raw')
    },
    {
      name: '004_create_player_teddies',
      sql: await import('../db/migrations/004_create_player_teddies.sql?raw')
    },
    {
      name: '005_create_player_teddies',
      sql: await import('../db/migrations/005_create_player_teddies.sql?raw')
    },
    {
      name: '009_update_player_teddies_relation',
      sql: await import('../db/migrations/009_update_player_teddies_relation.sql?raw')
    },
    {
      name: '011_fix_player_teddies_relation',
      sql: await import('../db/migrations/011_fix_player_teddies_relation.sql?raw')
    },
    {
      name: '016_update_player_teddies_relation',
      sql: await import('../db/migrations/016_update_player_teddies_relation.sql?raw')
    },
    {
      name: '017_create_terrible_teddies_table',
      sql: await import('../db/migrations/017_create_terrible_teddies_table.sql?raw')
    },
    {
      name: '018_create_players_table',
      sql: await import('../db/migrations/018_create_players_table.sql?raw')
    },
    {
      name: '019_create_player_teddies_table',
      sql: await import('../db/migrations/019_create_player_teddies_table.sql?raw')
    },
    {
      name: '020_create_terrible_teddies_table',
      sql: await import('../db/migrations/020_create_terrible_teddies_table.sql?raw')
    },
    {
      name: '021_create_player_teddies_table',
      sql: await import('../db/migrations/021_create_player_teddies_table.sql?raw')
    },
    {
      name: '023_create_game_tables',
      sql: await import('../db/migrations/023_create_game_tables.sql?raw')
    },
    {
      name: '024_add_player_teddies_foreign_key',
      sql: await import('../db/migrations/024_add_player_teddies_foreign_key.sql?raw')
    },
    {
      name: '025_add_player_teddies_foreign_key',
      sql: await import('../db/migrations/025_add_player_teddies_foreign_key.sql?raw')
    },
    {
      name: '027_add_player_teddies_foreign_key',
      sql: await import('../db/migrations/027_add_player_teddies_foreign_key.sql?raw')
    },
    {
      name: '028_add_player_teddies_foreign_key',
      sql: await import('../db/migrations/028_add_player_teddies_foreign_key.sql?raw')
    }
  ];

  for (const migration of migrations) {
    const { error } = await supabase.rpc('run_sql_migration', {
      sql: migration.sql
    });
    if (error) {
      console.error(`Error running migration ${migration.name}:`, error);
    } else {
      console.log(`Successfully ran migration: ${migration.name}`);
    }
  }
};