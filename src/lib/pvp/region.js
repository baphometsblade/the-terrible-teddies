// Where a Pub Brawl edge call runs. Supabase runs a function in the region
// nearest the caller, but every move then makes its database trips from
// there. For a player far from the database that is two or more ocean
// crossings per move instead of one, so hosted calls are pinned to the
// database's region. `forceFunctionRegion` rather than `x-region`: a query
// parameter needs no CORS preflight change. A pinned region is not rerouted
// in an outage, so pvpPost retries once unpinned when the pinned call fails
// at the gateway (every Pub Brawl op is idempotent or a read).

// The production project (wqdrbywcktxgytkyqcco) lives in Sydney.
export const DEFAULT_PVP_REGION = 'ap-southeast-2';

const REGION = /^[a-z]{2}-[a-z]+-\d$/;

/** The region to pin calls to for this Supabase URL, or '' to let the router choose. */
export function pvpRegion(baseUrl, configured) {
  const wanted = configured === undefined || configured === null ? DEFAULT_PVP_REGION : String(configured).trim();
  if (!wanted || wanted === 'any' || !REGION.test(wanted)) return '';
  try {
    // Only Supabase's hosted gateway routes by region; a local stack ignores it.
    return new URL(baseUrl).hostname.endsWith('.supabase.co') ? wanted : '';
  } catch {
    return '';
  }
}

/** The function URL, pinned to `region` when one is given. */
export function functionUrl(baseUrl, name, region) {
  const url = new URL(`functions/v1/${name}`, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (region) url.searchParams.set('forceFunctionRegion', region);
  return url.href;
}

/** Gateway failures that a different region could answer. */
export function regionFailed(status) {
  return status === 502 || status === 503 || status === 504 || status === 546;
}
