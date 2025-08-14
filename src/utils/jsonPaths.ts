export function getPath(object: any, path: string) {
  const parts = path.split(".");
  let cur: any = object;
  for (const p of parts) {
    if (p === "*") return undefined;
    if (p.endsWith("[]")) {
      const key = p.slice(0, -2);
      const arr = cur?.[key];
      if (!Array.isArray(arr) || arr.length === 0) return undefined;
      cur = arr[0];
      continue;
    }
    cur = cur?.[p];
  }
  return cur;
}

export function collectKeyPaths(
  value: any,
  prefix = "",
  depth = 3,
  out: Set<string> = new Set(),
): Set<string> {
  if (depth < 0 || value == null) return out;
  if (Array.isArray(value)) {
    const next = prefix ? `${prefix}[]` : "[]";
    out.add(next);
    if (value.length > 0) {
      collectKeyPaths(value[0], next, depth - 1, out);
    }
    return out;
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      out.add(path);
      collectKeyPaths(value[key], path, depth - 1, out);
    }
  }
  return out;
}
