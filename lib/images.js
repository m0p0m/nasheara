// On-demand image variants: /img/w800/uploads/photo.png -> 800px-wide WebP,
// resized once and cached on disk. Templates never link a multi-megabyte
// original again; if sharp is unavailable on the host everything falls back to
// the original files.
const path = require('path');
const fs = require('fs');
const express = require('express');

const PUBLIC_ROOT = path.resolve(__dirname, '..', 'public');
const CACHE_ROOT = path.resolve(__dirname, '..', 'cache', 'images');
const SOURCE_PREFIXES = ['/uploads/', '/icons/', '/images/'];
const WIDTHS = [160, 320, 480, 640, 800, 1024, 1280, 1600, 2048];
const QUALITY = 82;

let sharp = null;
try {
    sharp = require('sharp');
    // libvips otherwise starts one thread per CPU core of the (shared) server,
    // which counts against the hosting account's process limit.
    sharp.concurrency(1);
    sharp.cache({ memory: 50, files: 0, items: 100 });
} catch (error) { console.warn('sharp unavailable, serving original images:', error.message); }

const isLocalImage = src => typeof src === 'string' && SOURCE_PREFIXES.some(p => src.startsWith(p)) && /\.(png|jpe?g|webp|gif)$/i.test(src) && !src.includes('..');

// Pick the smallest allowed width that is >= the requested one.
const snap = width => WIDTHS.find(w => w >= width) || WIDTHS[WIDTHS.length - 1];

const mtimeCache = new Map();
const version = src => {
    const cached = mtimeCache.get(src);
    if (cached && cached.at > Date.now() - 60000) return cached.v;
    let v = '';
    try { v = Math.floor(fs.statSync(path.join(PUBLIC_ROOT, src)).mtimeMs / 1000).toString(36); } catch (e) { v = ''; }
    mtimeCache.set(src, { v, at: Date.now() });
    return v;
};

// URL of a variant. Non-local or unsupported sources are returned unchanged.
const imageUrl = (src, width) => {
    if (!isLocalImage(src) || !sharp) return src;
    const v = version(src);
    return `/img/w${snap(width)}${src}${v ? `?v=${v}` : ''}`;
};

// srcset for a handful of widths, capped at the largest requested.
const srcset = (src, widths) => {
    if (!isLocalImage(src) || !sharp) return '';
    return widths.map(w => `${imageUrl(src, w)} ${snap(w)}w`).join(', ');
};

// ` srcset="…" sizes="…"` ready to drop into an <img>; empty for non-local sources.
const responsive = (src, widths, sizes) => {
    const set = srcset(src, widths);
    return set ? ` srcset="${set}" sizes="${sizes}"` : '';
};

// Cache-busting URL for CSS/JS so static files can be cached for a long time.
const asset = src => {
    const v = version(src);
    return v ? `${src}?v=${v}` : src;
};

const router = express.Router();

router.get(/^\/w(\d+)\/(.+)$/, async (req, res, next) => {
    if (!sharp) return next();
    const width = parseInt(req.params[0], 10);
    const rel = '/' + req.params[1];
    if (!WIDTHS.includes(width) || !isLocalImage(rel)) return res.status(404).end();
    const source = path.resolve(PUBLIC_ROOT, '.' + rel);
    if (!source.startsWith(PUBLIC_ROOT + path.sep)) return res.status(404).end();
    const target = path.join(CACHE_ROOT, `w${width}`, rel.replace(/\.[^.]+$/, '') + '.webp');

    const send = () => {
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.sendFile(target);
    };
    try {
        const [src, cached] = await Promise.all([fs.promises.stat(source), fs.promises.stat(target).catch(() => null)]);
        if (cached && cached.mtimeMs >= src.mtimeMs) return send();
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
        await sharp(source, { animated: false })
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: QUALITY, effort: 4 })
            .toFile(tmp);
        await fs.promises.rename(tmp, target);
        send();
    } catch (error) {
        if (error.code === 'ENOENT') return res.status(404).end();
        console.error('Image variant failed:', rel, error.message);
        // Fall back to the original file rather than a broken image.
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.sendFile(source, err => { if (err) next(); });
    }
});

module.exports = { router, imageUrl, srcset, responsive, asset, isLocalImage, WIDTHS };
