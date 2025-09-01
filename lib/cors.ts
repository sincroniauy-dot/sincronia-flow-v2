export function buildCorsHeaders(origin?: string): Record<string, string> {
  const allowed = origin && /^http:\/\/localhost:(3000|3001)$/.test(origin) ? origin : (origin || "*");
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,content-type,if-match,if-none-match",
    "Access-Control-Expose-Headers": "etag,content-type,content-disposition",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function handleOptions(origin?: string): Response {
  const headers = buildCorsHeaders(origin);
  return new Response(null, { status: 204, headers });
}