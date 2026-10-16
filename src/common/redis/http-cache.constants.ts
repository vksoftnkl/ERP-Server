export const HTTP_CACHE_NAMESPACE = 'http-cache';
export const buildHttpCacheStoragePattern = (pattern: string): string => {
  if (!pattern || pattern === '*') {
    return `${HTTP_CACHE_NAMESPACE}:*`;
  }
  const normalizedPattern = pattern.endsWith('*') ? pattern : `${pattern}*`;
  return `${HTTP_CACHE_NAMESPACE}:${normalizedPattern}`;
};
