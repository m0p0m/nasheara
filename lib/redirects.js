// Permanent redirects for pages that no longer exist but that Google still
// shows (Search Console → Performance → Pages). A 404 throws away what the
// page had earned; a 301 hands it to the closest living page.
// Keys and values are paths without the locale prefix; the visitor's locale
// is kept. Add a line here whenever a page that had impressions is removed.
const MOVED = {
    '/about': '/',
    '/article/کاشی-دست-ساز-اسلیمی-راهنمای-کامل-انتخاب-و-کاربرد-در-دکوراسیون-سنتی-و-مدرن': '/article/کاشی-دست-ساز-چیست-و-چه-تفاوتی-با-کاشی-صنعتی-دارد',
    // Cross block withdrawn (no impressions); its links go to the block range.
    '/product/ceramic-breeze-block-cross': '/category/بلوک-سرامیکی-لعاب-دار'
};

// Old ASP.NET site on this domain.
const LEGACY = /^\/default\.aspx$/i;

const encodePath = p => p.split('/').map(encodeURIComponent).join('/');

module.exports = locales => (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let path;
    try { path = decodeURIComponent(req.path); } catch (e) { return next(); }
    if (LEGACY.test(path)) return res.redirect(301, '/fa/');
    const match = path.match(new RegExp(`^/(${locales.join('|')})(/.*)$`));
    const locale = match ? match[1] : 'fa';
    const rest = (match ? match[2] : path).replace(/\/$/, '') || '/';
    const target = MOVED[rest];
    if (target === undefined) return next();
    res.redirect(301, `/${locale}${target === '/' ? '/' : encodePath(target)}`);
};
