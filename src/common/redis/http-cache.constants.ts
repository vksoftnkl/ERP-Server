export const HTTP_CACHE_NAMESPACE = 'http-cache';
export const buildHttpCacheStoragePattern = (pattern: string): string => {
  if (!pattern || pattern === '*') {
    return `${HTTP_CACHE_NAMESPACE}:*`;
  }
  const normalizedPattern = pattern.endsWith('*') ? pattern : `${pattern}*`;
  return `${HTTP_CACHE_NAMESPACE}:${normalizedPattern}`;
};

// Extra resources to invalidate when a specific resource is mutated.
// e.g. changing ui-table-masters must also bust its dependent column config.
export const RELATED_RESOURCE_INVALIDATIONS: Record<string, string[]> = {
  'ui-table-masters': ['ui-table-columns'],
  'ui-table-columns': ['grid-columns', 'grid-details'],
};
