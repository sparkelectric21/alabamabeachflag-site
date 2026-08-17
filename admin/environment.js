export const PRODUCTION_HOSTS = Object.freeze(["alabamabeachflag.com", "www.alabamabeachflag.com"]);
export const STAGING_HOST = "staging.alabamabeachflag.com";
export const PRODUCTION_WORKER_ORIGIN = "https://alabamabeachflag-api.sparkelectricalservicesllc.workers.dev";
export const STAGING_WORKER_ORIGIN = "https://alabamabeachflag-api-staging.sparkelectricalservicesllc.workers.dev";

export function adminEnvironment(hostname = globalThis.location?.hostname ?? "") {
  const normalized = hostname.toLowerCase();
  if (normalized === STAGING_HOST) return "staging";
  if (PRODUCTION_HOSTS.includes(normalized)) return "production";
  return "local";
}

export function resolveApiURL(path, options = {}) {
  if (!path.startsWith("/")) throw new Error("api_path_must_be_absolute");
  const environment = options.environment ?? adminEnvironment(options.hostname);
  const origin = options.origin ?? "";
  if (environment === "staging" && origin && origin !== STAGING_WORKER_ORIGIN) throw new Error("staging_production_origin_rejected");
  if (environment === "production" && origin && origin !== PRODUCTION_WORKER_ORIGIN) throw new Error("production_origin_rejected");
  return `${origin}${path}`;
}

export function installEnvironmentPresentation(documentRef = document, locationRef = location) {
  const environment = adminEnvironment(locationRef.hostname);
  if (environment === "staging") {
    const banner = documentRef.createElement("div");
    banner.className = "environment-banner";
    banner.setAttribute("role", "status");
    banner.textContent = "STAGING — isolated non-production environment";
    documentRef.body.prepend(banner);
  }
  for (const link of documentRef.querySelectorAll("[data-api-path]")) {
    link.href = resolveApiURL(link.dataset.apiPath, { environment });
  }
  return environment;
}
