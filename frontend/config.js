/* Zovari deployment configuration.
 * After deploying the backend, replace the production placeholder below with
 * your backend Vercel URL, ending in /api. Keep localhost for local development.
 */
window.ZOVARI_CONFIG = {
  API_BASE: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "https://REPLACE-WITH-YOUR-BACKEND.vercel.app/api"
};
