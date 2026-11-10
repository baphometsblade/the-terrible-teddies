import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { bearerToken, serviceRoleAuthorized, timingSafeEqualString } from './auth.js';

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-key-not-a-real-secret.sig';

const forgedServiceRole = () => {
  const payload = Buffer.from(JSON.stringify({ role: 'service_role', sub: 'forged' })).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${payload}.forged`;
};

describe('send-push bearer check', () => {
  it('accepts only an exact match of the service role key', () => {
    expect(serviceRoleAuthorized(`Bearer ${SERVICE_KEY}`, SERVICE_KEY)).toBe(true);
    expect(serviceRoleAuthorized(`bearer ${SERVICE_KEY}`, SERVICE_KEY)).toBe(true);
  });

  it('rejects a forged payload that merely claims service_role', () => {
    const forged = forgedServiceRole();
    expect(forged).toContain('service_role');
    expect(serviceRoleAuthorized(`Bearer ${forged}`, SERVICE_KEY)).toBe(false);
  });

  it('rejects a player token, a prefix, a missing header, and an empty secret', () => {
    expect(serviceRoleAuthorized('Bearer player-jwt', SERVICE_KEY)).toBe(false);
    expect(serviceRoleAuthorized(`Bearer ${SERVICE_KEY.slice(0, -1)}`, SERVICE_KEY)).toBe(false);
    expect(serviceRoleAuthorized(`Bearer ${SERVICE_KEY}x`, SERVICE_KEY)).toBe(false);
    expect(serviceRoleAuthorized(null, SERVICE_KEY)).toBe(false);
    expect(serviceRoleAuthorized(`Bearer ${SERVICE_KEY}`, '')).toBe(false);
    expect(serviceRoleAuthorized(`Bearer ${SERVICE_KEY}`, undefined)).toBe(false);
    expect(bearerToken('Bearer one two')).toBe('');
  });

  it('compares equal strings and refuses a length mismatch', () => {
    expect(timingSafeEqualString('same-key', 'same-key')).toBe(true);
    expect(timingSafeEqualString('same-key', 'same-kez')).toBe(false);
    expect(timingSafeEqualString('short', 'longer-secret')).toBe(false);
    expect(timingSafeEqualString('', '')).toBe(true);
  });

  it('keeps the gateway check and does not trust an unverified payload', () => {
    const source = readFileSync(resolve(process.cwd(), 'supabase/functions/send-push/index.ts'), 'utf8');
    const toml = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');
    const example = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
    expect(source).toContain('serviceRoleAuthorized');
    expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(source).not.toContain('atob(');
    expect(source).not.toContain('jwtRole');
    expect(toml).toMatch(/\[functions\.send-push\]\s+verify_jwt = true/);
    expect(example).toContain('VITE_VAPID_PUBLIC_KEY=');
    expect(example).not.toMatch(/BEGIN PRIVATE KEY/);
  });
});
