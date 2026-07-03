/**
 * Cloudflare Pages middleware — Markdown for Agents (Accept: text/markdown).
 * Used when Advanced Mode is OFF and the functions/ directory is deployed.
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

const MARKDOWN_ROUTES = {
  '/': '/agent-home.md',
  '/index.html': '/agent-home.md'
};

function wantsMarkdown(request) {
  const accept = request.headers.get('Accept') || '';
  return /\btext\/markdown\b/i.test(accept);
}

function approxTokens(text) {
  return String(Math.ceil((text || '').length / 4));
}

async function loadMarkdown(context, mdPath) {
  if (context.env?.ASSETS) {
    const mdUrl = new URL(mdPath, 'https://placeholder.local');
    const res = await context.env.ASSETS.fetch(new Request(mdUrl.toString()));
    if (res.ok) return res.text();
  }
  const origin = new URL(context.request.url).origin;
  const res = await fetch(new URL(mdPath, origin).toString(), {
    headers: { Accept: 'text/plain' }
  });
  if (res.ok) return res.text();
  return null;
}

function markdownResponse(body) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Vary': 'Accept',
      'Cache-Control': 'public, max-age=300',
      'Link': LINK_HEADER,
      'x-markdown-tokens': approxTokens(body)
    }
  });
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'GET' && wantsMarkdown(request)) {
    const mdPath = MARKDOWN_ROUTES[path] || (path.endsWith('.html') ? path.replace(/\.html$/, '.md') : null);
    if (mdPath) {
      const body = await loadMarkdown(context, mdPath);
      if (body) return markdownResponse(body);
    }
  }

  const response = await next();
  if (path === '/' || path === '/index.html') {
    const headers = new Headers(response.headers);
    if (!headers.has('Link')) headers.set('Link', LINK_HEADER);
    headers.set('Vary', [headers.get('Vary'), 'Accept'].filter(Boolean).join(', '));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
  return response;
}
