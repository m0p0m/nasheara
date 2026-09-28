// Videos of a product or project, stored in its `video` JSON column:
//   { aparat: [{ hash, addedAt }], clip: '/uploads/…mp4', poster: '/uploads/…jpg' }
// Full videos live on Aparat (free hosting, plays in Iran, and each video's
// description links back to the site); the optional clip is a short muted
// loop served from our own host so the page still moves if Aparat is down.

const APARAT_HASH = /^[A-Za-z0-9]{3,32}$/;

// Accepts a watch URL (aparat.com/v/HASH…), an embed URL (…/videohash/HASH/…)
// or the bare hash.
const parseAparat = value => {
    const text = String(value || '').trim();
    if (!text) return null;
    const match = text.match(/aparat\.com\/v\/([A-Za-z0-9]+)/i) || text.match(/videohash\/([A-Za-z0-9]+)/i);
    const hash = match ? match[1] : text;
    return APARAT_HASH.test(hash) ? hash : null;
};

const embedUrl = hash => `https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame`;
const watchUrl = hash => `https://www.aparat.com/v/${hash}`;

const normalize = video => {
    if (!video || typeof video !== 'object') return { aparat: [], clip: null, poster: null };
    return {
        aparat: Array.isArray(video.aparat) ? video.aparat.filter(v => v && APARAT_HASH.test(v.hash)) : [],
        clip: typeof video.clip === 'string' && video.clip ? video.clip : null,
        poster: typeof video.poster === 'string' && video.poster ? video.poster : null
    };
};

const hasVideo = video => {
    const v = normalize(video);
    return Boolean(v.aparat.length || v.clip);
};

// Build the stored value from the admin form. Returns the new value (null when
// empty) and the uploaded files it no longer references, for deletion.
const fromForm = (body, files, existing) => {
    const current = normalize(existing);
    const seen = new Set();
    const aparat = String((body && body.videoAparat) || '')
        .split(/[\s,]+/)
        .map(parseAparat)
        .filter(hash => hash && !seen.has(hash) && seen.add(hash))
        .map(hash => current.aparat.find(v => v.hash === hash) || { hash, addedAt: new Date().toISOString() });
    const uploaded = name => (files && files[name] && files[name][0] ? `/uploads/${files[name][0].filename}` : null);
    const pick = (field, name, removeFlag) => uploaded(name) || (body && body[removeFlag] ? null : current[field]);
    const next = { aparat, clip: pick('clip', 'videoClip', 'removeVideoClip'), poster: pick('poster', 'videoPoster', 'removeVideoPoster') };
    const obsolete = ['clip', 'poster'].filter(f => current[f] && current[f] !== next[f]).map(f => current[f]);
    return { video: next.aparat.length || next.clip || next.poster ? next : null, obsolete };
};

// VideoObject JSON-LD for each Aparat video (and the clip when there is no
// Aparat video). `page` = { name, description, image, url } of the host page.
const schemas = (siteUrl, video, page) => {
    const v = normalize(video);
    const abs = p => (!p ? undefined : p.startsWith('http') ? p : `${siteUrl}${p}`);
    const thumbnail = abs(v.poster || page.image);
    if (!thumbnail) return [];
    const base = (name, uploadDate) => ({
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name,
        description: page.description || name,
        thumbnailUrl: [thumbnail],
        uploadDate
    });
    const list = v.aparat.map((item, i) => ({
        ...base(v.aparat.length > 1 ? `${page.name} (${i + 1})` : page.name, item.addedAt),
        embedUrl: embedUrl(item.hash),
        url: page.url
    }));
    if (!list.length && v.clip) list.push({ ...base(page.name, page.updatedAt || new Date().toISOString()), contentUrl: abs(v.clip), url: page.url });
    return list;
};

// <video:video> blocks for the sitemap entry of the host page.
const sitemapVideos = (siteUrl, video, page) => schemas(siteUrl, video, page).map(s => ({
    thumbnail: s.thumbnailUrl[0],
    title: s.name,
    description: s.description,
    player: s.embedUrl,
    content: s.contentUrl,
    date: s.uploadDate
}));

module.exports = { parseAparat, embedUrl, watchUrl, normalize, hasVideo, fromForm, schemas, sitemapVideos };
