// Imports the glazed ceramic block catalogue into a live Naghsh Ara site
// through its own admin form endpoints (session login + CSRF + multipart).
//
// Usage (PowerShell):
//   $env:SITE_URL='https://naghsh-araco.com'; $env:ADMIN_USER='admin'; $env:ADMIN_PASS='...'
//   node scripts/import-products/import.js [--dry-run]
//
// Images are read from IMAGES_DIR (default: scripts/import-products/images).

const fs = require('fs');
const path = require('path');
const { CATEGORY, CATEGORY_IMAGE, PRODUCTS, OBSOLETE_SLUG_PREFIX } = require('./data');

const SITE_URL = (process.env.SITE_URL || 'https://naghsh-araco.com').replace(/\/$/, '');
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const IMAGES_DIR = process.env.IMAGES_DIR || path.join(__dirname, 'images');
const DRY_RUN = process.argv.includes('--dry-run');
// --update re-sends the text fields of products that already exist (no images).
const UPDATE = process.argv.includes('--update');

if (!ADMIN_USER || !ADMIN_PASS) {
    console.error('Set ADMIN_USER and ADMIN_PASS environment variables first.');
    process.exit(1);
}

// --- minimal cookie jar -----------------------------------------------------
const jar = new Map();
const absorbCookies = res => {
    const list = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [res.headers.get('set-cookie')].filter(Boolean);
    for (const raw of list) {
        const [pair] = raw.split(';');
        const eq = pair.indexOf('=');
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
};
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

const request = async (pathname, init = {}) => {
    const res = await fetch(SITE_URL + pathname, {
        ...init,
        redirect: 'manual',
        signal: AbortSignal.timeout(90000),
        headers: { Cookie: cookieHeader(), Accept: 'text/html', ...(init.headers || {}) }
    });
    absorbCookies(res);
    return res;
};

const readCsrf = html => {
    const m = html.match(/name="_csrf"\s+value="([^"]+)"/);
    if (!m) throw new Error('CSRF token not found in page');
    return m[1];
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- steps -------------------------------------------------------------------
async function login() {
    const page = await request('/admin/login');
    const csrf = readCsrf(await page.text());
    const body = new URLSearchParams({ _csrf: csrf, username: ADMIN_USER, password: ADMIN_PASS });
    const res = await request('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });
    const location = res.headers.get('location') || '';
    if (res.status !== 302 || !location.includes('/admin/dashboard')) {
        throw new Error(`Login failed (status ${res.status}, redirect to ${location || 'none'})`);
    }
    console.log('✔ logged in');
}

async function ensureCategory() {
    const page = await request('/admin/products/add');
    if (page.status !== 200) throw new Error(`Cannot open product form (status ${page.status})`);
    const html = await page.text();
    const csrf = readCsrf(html);
    if (html.includes(`<option value="${CATEGORY.name}"`)) {
        console.log(`✔ category exists: ${CATEGORY.name}`);
        return csrf;
    }
    if (DRY_RUN) { console.log(`[dry-run] would create category ${CATEGORY.name}`); return csrf; }
    const form = new FormData();
    form.set('_csrf', csrf);
    form.set('name', CATEGORY.name);
    form.set('description', CATEGORY.description);
    const res = await request('/admin/categories/add', { method: 'POST', body: form });
    if (res.status !== 302) throw new Error(`Category create failed (status ${res.status}): ${(await res.text()).slice(0, 300)}`);
    console.log(`✔ category created: ${CATEGORY.name}`);
    return csrf;
}

// The public product page on a missing slug is slow, so read the slugs the
// admin list already renders (one request) instead of probing per product.
async function ensureCategoryImage(csrf) {
    const res = await request('/admin/categories');
    if (res.status !== 200) throw new Error(`Cannot open categories (status ${res.status})`);
    const html = await res.text();
    // Locate the row by name, then look back to its <tr> for an existing cover
    // and forward for its edit link (which carries the id).
    const at = html.indexOf(`${CATEGORY.name}</div>`);
    if (at < 0) throw new Error('Category row not found on /admin/categories');
    const rowStart = html.lastIndexOf('<tr', at);
    const idMatch = html.slice(at).match(/\/admin\/categories\/edit\/([\w-]+)/);
    if (!idMatch) throw new Error('Category edit link not found');
    const id = idMatch[1];
    if (/<img [^>]*\/uploads\//.test(html.slice(rowStart, at))) {
        console.log('✔ category already has a cover image');
        return;
    }
    if (DRY_RUN) { console.log(`[dry-run] would set category image (${CATEGORY_IMAGE}) on #${id}`); return; }
    const form = new FormData();
    form.set('_csrf', csrf);
    form.set('name', CATEGORY.name);
    form.set('description', CATEGORY.description);
    form.set('mainImage', fileBlob(CATEGORY_IMAGE), CATEGORY_IMAGE);
    await post(`/admin/categories/edit/${id}`, form);
    console.log('✔ category cover image set');
}

async function listProducts() {
    const found = new Map(); // slug -> id
    for (let page = 1; page < 50; page++) {
        const res = await request(`/admin/dashboard?page=${page}`);
        if (res.status !== 200) throw new Error(`Cannot open dashboard (status ${res.status})`);
        const html = await res.text();
        if (process.env.DUMP_HTML) fs.writeFileSync(`${process.env.DUMP_HTML}-${page}.html`, html);
        // Each row renders "…/<slug></div>" followed by its edit link with the id.
        const rows = [...html.matchAll(/ltr-text\">[^<]*\/([a-z0-9؀-ۿ-]+)<\/div>[\s\S]*?\/admin\/products\/edit\/([\w-]+)/g)];
        if (!rows.length) break;
        for (const [, slug, id] of rows) found.set(slug, id);
    }
    return found;
}

async function deleteObsolete(existing, csrf) {
    const keep = new Set(PRODUCTS.map(p => p.slug));
    for (const [slug, id] of existing) {
        if (keep.has(slug) || !slug.startsWith(OBSOLETE_SLUG_PREFIX)) continue;
        if (DRY_RUN) { console.log(`[dry-run] would delete #${id} ${slug}`); continue; }
        const form = new URLSearchParams({ _csrf: csrf });
        const res = await request(`/admin/products/delete/${id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form
        });
        console.log(`${res.status === 302 ? '🗑 deleted' : '✖ delete failed (' + res.status + ')'}: #${id} ${slug}`);
        existing.delete(slug);
        await sleep(400);
    }
}

const fileBlob = name => {
    const p = path.join(IMAGES_DIR, name);
    if (!fs.existsSync(p)) throw new Error(`Missing image ${p}`);
    return new Blob([fs.readFileSync(p)], { type: 'image/webp' });
};

function baseForm(product, csrf) {
    const form = new FormData();
    form.set('_csrf', csrf);
    form.set('slug', product.slug);
    form.set('category', CATEGORY.name);
    form.set('stock', String(product.stock));
    if (product.isNew) form.set('isNew', 'on');
    if (product.isBestSeller) form.set('isBestSeller', 'on');
    form.set('tileWidthCm', String(product.tileWidthCm));
    form.set('tileHeightCm', String(product.tileHeightCm));
    form.set('tileShape', product.tileShape);

    // Field names stay ASCII: multer decodes part names as latin1, so a Persian
    // spec key in the name would arrive as mojibake. Specs go as "key: value" text.
    for (const [locale, t] of Object.entries(product.translations)) {
        for (const [key, value] of Object.entries(t)) form.set(`translations[${locale}][${key}]`, value);
    }
    return form;
}

const GALLERY_BATCH = 5; // upload middleware allows 5 gallery files per request

const post = async (pathname, form) => {
    const res = await request(pathname, { method: 'POST', body: form });
    if (res.status !== 302) {
        throw new Error(`status ${res.status}: ${(await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300)}`);
    }
};

async function createProduct(product, csrf) {
    const [first, ...rest] = chunk(product.galleryImages, GALLERY_BATCH);
    const form = baseForm(product, csrf);
    form.set('mainImage', fileBlob(product.mainImage), product.mainImage);
    for (const g of first || []) form.append('galleryImages', fileBlob(g), g);
    await post('/admin/products/add', form);
    if (!rest.length) return;

    // Remaining gallery images are appended through the edit form.
    const id = (await listProducts()).get(product.slug);
    if (!id) throw new Error('created but not found on dashboard for gallery append');
    for (const batch of rest) {
        const f = baseForm(product, csrf);
        for (const g of batch) f.append('galleryImages', fileBlob(g), g);
        await post(`/admin/products/edit/${id}`, f);
        await sleep(800);
    }
}

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

(async () => {
    await login();
    const csrf = await ensureCategory();
    const existing = await listProducts();
    await deleteObsolete(existing, csrf);
    await ensureCategoryImage(csrf);

    let created = 0, skipped = 0, failed = 0;
    for (const product of PRODUCTS) {
        const label = `${product.slug} — ${product.translations.fa.name}`;
        if (existing.has(product.slug)) {
            if (!UPDATE) { console.log(`↷ skip (exists): ${label}`); skipped++; continue; }
            if (DRY_RUN) { console.log(`[dry-run] would update: ${label}`); continue; }
            try {
                await post(`/admin/products/edit/${existing.get(product.slug)}`, baseForm(product, csrf));
                console.log(`✔ updated: ${label}`); created++;
            } catch (err) { console.error(`✖ update failed: ${label} → ${err.message}`); failed++; }
            await sleep(800);
            continue;
        }
        if (DRY_RUN) { console.log(`[dry-run] would create: ${label}`); continue; }
        try {
            await createProduct(product, csrf);
            console.log(`✔ created: ${label}`);
            created++;
        } catch (err) {
            console.error(`✖ failed: ${label} → ${err.message}`);
            failed++;
        }
        // adminMutationLimiter is per-IP; keep a gentle pace.
        await sleep(1500);
    }
    console.log(`\nDone. created=${created} skipped=${skipped} failed=${failed}`);
})().catch(err => { console.error(err.message); process.exit(1); });
