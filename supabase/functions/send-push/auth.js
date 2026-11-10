// The gateway's verify_jwt check is not the only gate. A deploy with
// --no-verify-jwt would otherwise accept any bearer, including one whose
// payload merely says role=service_role. The database webhook sends the
// service role key itself, so the function compares that secret to the
// bearer and ignores the decoded claims.

const encoder = new TextEncoder();

/** The token after "Bearer ", or "" when the header is not that shape. */
export const bearerToken = (header) => {
  const match = /^Bearer\s+(\S+)$/i.exec(String(header || '').trim());
  return match ? match[1] : '';
};

/**
 * Constant-time equality for two strings. Different lengths still walk the
 * longer input, then fail. An empty string equals an empty string; callers
 * that treat empty as "not configured" must reject that before calling.
 */
export const timingSafeEqualString = (leftText, rightText) => {
  const left = encoder.encode(String(leftText));
  const right = encoder.encode(String(rightText));
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }
  return diff === 0;
};

/** True only when the bearer is exactly the configured service role key. */
export const serviceRoleAuthorized = (authorizationHeader, serviceRoleKey) => {
  const token = bearerToken(authorizationHeader);
  const key = typeof serviceRoleKey === 'string' ? serviceRoleKey : '';
  if (!token || !key) return false;
  return timingSafeEqualString(token, key);
};

/**
 * True when the bearer matches any of the provided secrets. Empty entries are
 * skipped. Every non-empty secret is compared so the work does not shrink
 * after the first match.
 */
export const serviceRoleAuthorizedAny = (authorizationHeader, serviceRoleKeys) => {
  const keys = Array.isArray(serviceRoleKeys) ? serviceRoleKeys : [serviceRoleKeys];
  let ok = false;
  for (const key of keys) {
    if (serviceRoleAuthorized(authorizationHeader, key)) ok = true;
  }
  return ok;
};
