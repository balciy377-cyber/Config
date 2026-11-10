import { createRemoteJWKSet, jwtVerify } from 'jose';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const uuid = () => crypto.randomUUID();
const CATEGORIES = new Set(['PUBG Mobile', 'Android', 'iOS', 'PAK', 'Duyuru']);

let jwks;
async function isAdmin(request, env) {
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) return false;
  try {
    const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
    jwks ||= createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: env.ACCESS_AUD });
    const allowed = env.ADMIN_EMAILS.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    return typeof payload.email === 'string' && allowed.includes(payload.email.toLowerCase());
  } catch { return false; }
}
function validTelegram(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && (u.hostname === 't.me' || u.hostname === 'www.t.me') && u.pathname.length > 1;
  } catch { return false; }
}
function cleanText(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function mediaResponse(object) {
  const headers = new Headers({ 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  return new Response(object.body, { headers });
}
async function validImage(file) {
  if (!(file instanceof File) || file.size < 12 || file.size > 5 * 1024 * 1024) return false;
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
  if (jpg && file.type === 'image/jpeg') return 'jpg';
  if (png && file.type === 'image/png') return 'png';
  if (webp && file.type === 'image/webp') return 'webp';
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/items' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT id,name,category,version,description,telegram_url,image_key,created_at FROM items ORDER BY created_at DESC'
        ).all();
        return json({ items: results.map(item => ({ ...item, image_url: item.image_key ? `/media/${item.image_key}` : null })) });
      }

      if (url.pathname.startsWith('/media/') && request.method === 'GET') {
        const key = url.pathname.slice('/media/'.length);
        if (!/^covers\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) return new Response('Not found', { status: 404 });
        const object = await env.MEDIA.get(key);
        return object ? mediaResponse(object) : new Response('Not found', { status: 404 });
      }

      if (url.pathname.startsWith('/api/admin/')) {
        if (!(await isAdmin(request, env))) return json({ error: 'Yetkisiz erişim. Cloudflare Access oturumunu kontrol et.' }, 401);

        if (url.pathname === '/api/admin/upload' && request.method === 'POST') {
          const form = await request.formData();
          const file = form.get('file');
          const ext = await validImage(file);
          if (!ext) return json({ error: 'Geçersiz görsel. Gerçek JPG, PNG veya WebP; en fazla 5 MB.' }, 400);
          const key = `covers/${uuid()}.${ext}`;
          await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=3600' } });
          return json({ key, url: `/media/${key}` }, 201);
        }

        if (url.pathname === '/api/admin/items' && request.method === 'POST') {
          const d = await request.json();
          const name = cleanText(d.name, 90), category = CATEGORIES.has(d.category) ? d.category : 'PUBG Mobile';
          const telegram = cleanText(d.telegram_url, 500);
          if (!name || !validTelegram(telegram)) return json({ error: 'İçerik adı ve geçerli Telegram gönderi bağlantısı zorunlu.' }, 400);
          const key = uuid(), now = new Date().toISOString();
          const imageKey = typeof d.image_url === 'string' && /^\/media\/covers\/[a-f0-9-]+\.(jpg|png|webp)$/.test(d.image_url) ? d.image_url.slice(7) : '';
          await env.DB.prepare('INSERT INTO items (id,name,category,version,description,telegram_url,image_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
            .bind(key, name, category, cleanText(d.version, 40), cleanText(d.description, 1200), telegram, imageKey, now, now).run();
          return json({ ok: true, id: key }, 201);
        }

        const match = url.pathname.match(/^\/api\/admin\/items\/([a-f0-9-]+)$/i);
        if (match && request.method === 'PUT') {
          const d = await request.json();
          const name = cleanText(d.name, 90), telegram = cleanText(d.telegram_url, 500);
          if (!name || !validTelegram(telegram)) return json({ error: 'Geçersiz içerik verisi.' }, 400);
          const category = CATEGORIES.has(d.category) ? d.category : 'PUBG Mobile';
          const imageKey = typeof d.image_url === 'string' && /^\/media\/covers\/[a-f0-9-]+\.(jpg|png|webp)$/.test(d.image_url) ? d.image_url.slice(7) : '';
          const old = await env.DB.prepare('SELECT image_key FROM items WHERE id=?').bind(match[1]).first();
          await env.DB.prepare('UPDATE items SET name=?,category=?,version=?,description=?,telegram_url=?,image_key=?,updated_at=? WHERE id=?')
            .bind(name, category, cleanText(d.version, 40), cleanText(d.description, 1200), telegram, imageKey, new Date().toISOString(), match[1]).run();
          if (old?.image_key && old.image_key !== imageKey) await env.MEDIA.delete(old.image_key);
          return json({ ok: true });
        }
        if (match && request.method === 'DELETE') {
          const old = await env.DB.prepare('SELECT image_key FROM items WHERE id=?').bind(match[1]).first();
          await env.DB.prepare('DELETE FROM items WHERE id=?').bind(match[1]).run();
          if (old?.image_key) await env.MEDIA.delete(old.image_key);
          return json({ ok: true });
        }
        return json({ error: 'Not found' }, 404);
      }

      // Worker Static Assets serves the website for all non-API routes.
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('YargıConfig request failed:', error);
      return json({ error: 'Sunucu hatası. Worker loglarını kontrol et.' }, 500);
    }
  },
};
