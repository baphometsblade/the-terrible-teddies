// Build-time stand-in for @supabase/storage-js. See supabase-realtime.js for
// the full rationale — same story: statically imported by supabase-js and
// constructed eagerly in its constructor, but this app never uploads or reads
// a file, so it was pure first-paint weight.

// A real Error subclass: supabase-js uses StorageApiError in instanceof checks,
// so this has to behave like the genuine article even though it never fires.
export class StorageApiError extends Error {
  constructor(message, status, statusCode) {
    super(message);
    this.name = 'StorageApiError';
    this.status = status;
    this.statusCode = statusCode;
  }
}

export class StorageClient {
  // Silent constructor: supabase-js builds this eagerly for every client.
  constructor() {}

  from() {
    throw new Error(
      'Supabase Storage is not bundled in this app. It is aliased to a stub in ' +
        'vite.config.js to keep unused code out of the entry chunk. If you now ' +
        'need Storage, remove that alias and the guard in ' +
        'src/stubs/supabase-stubs.test.js.'
    );
  }
}

export default { StorageApiError, StorageClient };
