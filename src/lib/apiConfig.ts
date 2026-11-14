declare global {
  interface ImportMetaEnv {
    /** Base URL of the optional sync server, e.g. http://localhost:8787. Unset = local only. */
    readonly VITE_API_URL?: string;
  }
}

/** Sync server URL without a trailing slash, or '' when sync is off (the default). */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
