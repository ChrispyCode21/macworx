// Paths the service worker never answers from its cache (vite.config.ts): they always go to the network.
// Workbox matches these against the path and query, so each allows a query string.
// - /api: the Worker's.
// - /parent: behind Cloudflare Access, which must be able to ask a parent to sign in.
// - /cdn-cgi: Cloudflare's own, including Access finishing a sign-in on this host
//   (/cdn-cgi/access/authorized sets its cookie) and signing out.
export const NETWORK_ONLY_PATHS: RegExp[] = [/^\/api(?:[/?]|$)/, /^\/parent(?:[/?]|$)/, /^\/cdn-cgi\//]
