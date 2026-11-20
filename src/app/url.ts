export function appUrl(path = ""): string {
  const basePath = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/harmonica/";
  const origin = typeof location !== "undefined" && location.origin && location.origin !== "null" ? location.origin : "http://localhost";
  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(cleanPath, new URL(normalizedBase, origin)).toString();
}

export function workbenchUrl(query = ""): string {
  return appUrl(`tools/score-import/${query}`);
}

export function trainerUrl(query = ""): string {
  return appUrl(query);
}
