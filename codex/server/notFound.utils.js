const API_PREFIXES = ['/api', '/auth', '/collab'];

export function stripQueryFromUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    return '/';
  }
  const [pathname] = rawUrl.split('?');
  return pathname || '/';
}

export function isApiRoutePath(rawUrl) {
  const pathname = stripQueryFromUrl(rawUrl);
  return API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

