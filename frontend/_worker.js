/**
 * Cloudflare Pages Advanced Mode worker.
 * Serves markdown when Accept: text/markdown; otherwise static assets.
 * Enable: Pages project → Settings → Functions → Advanced Mode → ON.
 */
const LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</docs/api.md>; rel="service-doc"',
  '</docs/api/openapi.json>; rel="service-desc"',
  '</.well-known/oauth-protected-resource>; rel="oauth-protected-resource"',
  '</.well-known/openid-configuration>; rel="openid-configuration"',
  '</auth.md>; rel="describedby"',
  '</llms.txt>; rel="describedby"',
  '</.well-known/agent-skills/index.json>; rel="agent-skills"',
  '</.well-known/mcp/server-card.json>; rel="mcp-server-card"'
].join(', ');

function wantsMarkdown(request) {
  const accept = request.headers.get('Accept') || '';
  return /\btext\/markdown\b/i.test(accept);
}

function approxTokens(text) {
  return String(Math.ceil((text || '').length / 4));
}

function markdownPath(pathname) {
  if (pathname === '/' || pathname === '/index.html') return '/agent-home.md';
  if (pathname.endsWith('.html')) return pathname.replace(/\.html$/, '.md');
  return null;
}

async function fetchMarkdown(env, mdPath) {
  const mdUrl = new URL(mdPath, 'https://placeholder.local');
  return env.ASSETS.fetch(new Request(mdUrl.toString()));
}

function markdownResponse(body, extraHeaders = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Vary': 'Accept',
      'Cache-Control': 'public, max-age=300',
      'Link': LINK_HEADER,
      'x-markdown-tokens': approxTokens(body),
      ...extraHeaders
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'GET' && wantsMarkdown(request)) {
      const mdPath = markdownPath(path);
      if (mdPath) {
        const mdRes = await fetchMarkdown(env, mdPath);
        if (mdRes.ok) {
          return markdownResponse(await mdRes.text());
        }
      }
    }

    const response = await env.ASSETS.fetch(request);
    if ((path === '/' || path === '/index.html') && response.ok) {
      const headers = new Headers(response.headers);
      if (!headers.has('Link')) headers.set('Link', LINK_HEADER);
      const vary = headers.get('Vary');
      headers.set('Vary', [vary, 'Accept'].filter(Boolean).join(', '));
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }
    return response;
  }
};
