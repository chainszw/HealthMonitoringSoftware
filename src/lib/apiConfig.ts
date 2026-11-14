declare global {
  interface ImportMetaEnv {
    /** Base URL of the optional sync server, e.g. http://localhost:8787. Unset = local only. */
    readonly VITE_API_URL?: string;
    /**
     * Crew token used when nobody has signed in. For local work and demos only: it is built into
     * the public JavaScript bundle.
     */
    readonly VITE_API_TOKEN?: string;
  }
}

/** Sync server URL without a trailing slash, or '' when sync is off (the default). */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

/** Fallback crew token for demos, or '' (the normal case: crew members sign in). */
export const API_TOKEN: string = (import.meta.env.VITE_API_TOKEN ?? '').trim();
