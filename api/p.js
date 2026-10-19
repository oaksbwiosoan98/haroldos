// Harold OS — web proxy for the in-phone browser.
// Websites are fetched here and served from the same address as Harold OS, so the phone can
// read them (Liquid Glass over real sites, compact bar when scrolling). Harold OS shows them in a
// sandboxed frame with scripts disabled, so a website can never act on Harold OS.
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

module.exports = async (req, res) => {
  if (req.query.ping) { res.setHeader('content-type', 'application/json'); return res.status(200).send('{"ok":true}'); }
  let u = String(req.query.url || '');
  /* a search form of the site (rewritten by Harold OS): its real address + the fields typed */
  if (req.query.__hos_u) {
    try { const t = new URL(String(req.query.__hos_u)); t.search = ''; for (const [k, v] of Object.entries(req.query)) { if (k === '__hos_u') continue; (Array.isArray(v) ? v : [v]).forEach(x => t.searchParams.append(k, String(x))); } u = t.href; } catch (e) { u = ''; }
  }
  if (!/^https?:\/\//i.test(u)) return res.status(400).send('Adresse invalide');
  let r;
  try {
    r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': UA, 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.6', accept: 'text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8' } });
  } catch (e) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    return res.status(502).send('<meta name="viewport" content="width=device-width"><p style="font:16px system-ui;padding:24px">Ce site ne répond pas.</p>');
  }
  const ct = r.headers.get('content-type') || 'application/octet-stream';
  res.setHeader('access-control-allow-origin', '*');
  if (/text\/html|application\/xhtml/i.test(ct)) {
    let html = await r.text();
    const final = r.url || u;
    html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy[^>]*>/gi, '');
    const inject = `<base href="${esc(final)}"><meta name="referrer" content="no-referrer"><meta name="hos-url" content="${esc(final)}">`;
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + inject) : inject + html;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=120');
    return res.status(r.status).send(html);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader('content-type', ct);
  res.setHeader('cache-control', 'public, max-age=86400, s-maxage=86400');
  return res.status(r.status).send(buf);
};
