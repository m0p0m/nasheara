require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const MySQLStore = require('express-mysql-session')(session);
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { i18next, middleware: i18nMiddleware, supportedLocales } = require('./config/i18n');
const { readCsrfToken, authorizeCsrf } = require('./middleware/csrf');
const { loginLimiter, newsletterLimiter, consultationLimiter, uploadLimiter, adminMutationLimiter } = require('./middleware/rateLimit');
const images = require('./lib/images');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
app.locals.siteUrl = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// One address per page: http:// and www. copies were served as duplicates.
// Send them to SITE_URL with a permanent redirect (production only; the
// proxy's X-Forwarded-Proto tells us the original scheme).
if (process.env.NODE_ENV === 'production' && process.env.SITE_URL) {
    const canonical = new URL(app.locals.siteUrl);
    const canonicalProto = canonical.protocol.replace(':', '');
    app.use((req, res, next) => {
        const host = (req.hostname || '').toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1') return next();
        if (host === canonical.hostname && req.protocol === canonicalProto) return next();
        res.redirect(301, `${canonical.origin}${req.originalUrl}`);
    });
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Load-test baseline: no DB call, pure Node/Express overhead.
app.get('/api/ping', (req, res) => res.status(200).json({ ok: true }));

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
            connectSrc: ["'self'"],
            // Aparat players load only after a click (views/public/_video.ejs).
            frameSrc: ['https://www.openstreetmap.org', 'https://www.aparat.com'],
            frameAncestors: ["'none'"]
        }
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
    xPermittedCrossDomainPolicies: true
}));

app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), accelerometer=(), autoplay=(), clipboard-write=(), fullscreen=(self)');
    next();
});
app.use(compression());
// Resized WebP variants of uploads/icons (see lib/images.js)
app.use('/img', images.router);
app.locals.img = images.imageUrl;
app.locals.srcset = images.srcset;
app.locals.responsive = images.responsive;
app.locals.asset = images.asset;
const videoLib = require('./lib/video');
app.locals.videoNormalize = videoLib.normalize;
app.locals.videoEmbedUrl = videoLib.embedUrl;
app.locals.videoWatchUrl = videoLib.watchUrl;
app.locals.hasVideo = videoLib.hasVideo;
app.use(express.static(path.join(__dirname, 'public'), {
    // CSS/JS are linked with ?v=<mtime> (app.locals.asset), so they can be cached long too.
    maxAge: '30d',
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (['.woff', '.woff2', '.ttf', '.eot', '.otf'].includes(ext)) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'].includes(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000');
        }
    }
}));

app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    next();
});

const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required before the server can start.');
}
const sessionSecret = process.env.SESSION_SECRET;

// Helper: detect if the original client request was HTTPS (works behind cPanel/LiteSpeed reverse proxy)
const isSecureProxy = (req) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (forwardedProto) return forwardedProto.toLowerCase().includes('https');
    if (req.connection && req.connection.encrypted) return true;
    return false;
};

// --- MySQL session store (replaces in-memory MemoryStore) ---
// Parse DATABASE_URL (same connection used by Prisma) to reuse credentials.
// DATABASE_URL format: mysql://user:password@host:port/database
if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing. Please set it in .env or the host environment.');
}
const dbUrl = new URL(process.env.DATABASE_URL);
const sessionStoreOptions = {
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port, 10) || 3306,
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ''),
    // This is a cheap `CREATE TABLE IF NOT EXISTS`; keep it enabled so a new
    // installation cannot fail every login because its session table is absent.
    createDatabaseTable: true,
    // Do not start a cleanup timer in every Passenger worker. Expired rows can
    // be removed by a daily database job (documented in DEPLOYMENT.md).
    clearExpired: false,
    expiration: 7 * 24 * 60 * 60 * 1000 // 7 days (matches cookie maxAge)
};
const sessionStore = new MySQLStore(sessionStoreOptions);

app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

app.use((req, res, next) => {
    if (req.session && req.session.cookie) {
        req.session.cookie.secure = isSecureProxy(req) || isProduction;
        req.session.cookie.httpOnly = true;
        req.session.cookie.sameSite = 'lax';
    }
    // Minting a token marks the session dirty, which persists a row for every
    // visitor. Defer it so only responses that actually embed the token
    // (i.e. pages with a form) create a session.
    Object.defineProperty(res.locals, 'csrfToken', {
        get: () => (req.session ? readCsrfToken(req) : ''),
        configurable: true,
        enumerable: true
    });
    next();
});

app.use(i18nMiddleware.handle(i18next));
app.use((req, res, next) => {
    const firstSegment = req.path.split('/').filter(Boolean)[0];
    const locale = supportedLocales.includes(firstSegment) ? firstSegment : 'fa';
    const pathWithoutLocale = supportedLocales.includes(firstSegment)
        ? (req.path.replace(new RegExp(`^/${firstSegment}(?=/|$)`), '') || '/')
        : req.path;
    req.locale = locale;
    res.locals.locale = locale;
    res.locals.dir = locale === 'en' ? 'ltr' : 'rtl';
    res.locals.t = i18next.getFixedT(locale, 'common');
    res.locals.localePath = targetPath => {
        const cleanPath = String(targetPath || '/').replace(/^\/(fa|en|ar)(?=\/|$)/, '') || '/';
        return `/${locale}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
    };
    res.locals.alternateUrls = Object.fromEntries(
        supportedLocales.map(language => [language, `${app.locals.siteUrl}/${language}${pathWithoutLocale === '/' ? '/' : pathWithoutLocale}`])
    );
    res.locals.alternateUrls['x-default'] = `${app.locals.siteUrl}/fa${pathWithoutLocale === '/' ? '/' : pathWithoutLocale}`;
    // Never canonicalize a localized page to an unlocalized URL or to a filter
    // query. Both cases split Google’s indexing signals.
    res.locals.canonicalUrl = `${app.locals.siteUrl}/${locale}${pathWithoutLocale === '/' ? '/' : pathWithoutLocale}`;
    next();
});

// Routes
const adminRoutes = require('./routes/admin');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const publicRoutes = require('./routes/public'); // New
const publicController = require('./controllers/publicController');
const ensureAuthenticated = require('./middleware/auth');
const productController = require('./controllers/productController');
const consultationController = require('./controllers/consultationController'); // New

// Public localized routes and SEO endpoints
app.get('/', (req, res) => res.redirect(301, '/fa/'));
app.get('/sitemap.xml', publicController.getSitemap);
app.get('/robots.txt', publicController.getRobots);
app.use(require('./lib/redirects')(supportedLocales));
app.use((req, res, next) => {
    const isLegacyPublicPath = /^\/(products|projects|articles|contact|consultation)(\/|$)/.test(req.path)
        || /^\/(product|project|article)\//.test(req.path);
    if (req.method === 'GET' && isLegacyPublicPath) return res.redirect(301, `/fa${req.originalUrl}`);
    next();
});
for (const locale of supportedLocales) app.use(`/${locale}`, publicRoutes);

// Redirect /login to /admin/login
app.get('/login', (req, res) => {
    res.redirect('/admin/login');
});

// Redirect /admin to /admin/dashboard if authenticated, otherwise to /admin/login
app.get('/admin', (req, res) => {
    if (req.session && req.session.isAuthenticated) {
        res.redirect('/admin/dashboard');
    } else {
        res.redirect('/admin/login');
    }
});

// Admin routes
app.use('/admin', adminRoutes);
app.use('/admin/categories', categoryRoutes);
app.use('/admin/products', productRoutes);
app.use('/admin/projects', require('./routes/projects'));
app.use('/admin/articles', require('./routes/articles'));

// Protected dashboard route now shows the product list
app.get('/admin/dashboard', ensureAuthenticated, productController.listProducts);

// Protected consultation list route
app.get('/admin/consultations', ensureAuthenticated, consultationController.listConsultations); // New
// Mark consultation(s) as contacted (by phone) - POST
app.post('/admin/consultations/mark/:phone', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, consultationController.markContacted);
app.post('/admin/consultations/mark-id/:id', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, consultationController.markContactedById);

app.use((req, res) => {
    if (req.accepts('html')) {
        return res.status(404).render('public/not-found', {
            title: '404 - صفحه مورد نظر یافت نشد',
            noindex: true,
            layout: 'public/layout',
            currentPath: req.path,
            siteUrl: app.locals.siteUrl
        });
    }
    return res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
    if (err && err.name === 'MulterError') {
        const messages = {
            LIMIT_FILE_SIZE: 'حجم هر تصویر باید کمتر از ۵ مگابایت باشد.',
            LIMIT_FILE_COUNT: 'تعداد تصاویر بیشتر از حد مجاز است.',
            LIMIT_UNEXPECTED_FILE: 'فیلد تصویر نامعتبر است.',
            LIMIT_PART_COUNT: 'فرم بیش از حد بزرگ است؛ تعداد فیلدها را کم کنید.'
        };
        const message = messages[err.code] || 'بارگذاری فایل ناموفق بود.';
        if (req.accepts('html')) {
            return res.status(400).render('public/error', {
                title: 'خطا در ارسال فرم',
                layout: 'public/layout',
                noindex: true,
                currentPath: req.path,
                siteUrl: app.locals.siteUrl,
                errorMessage: message
            });
        }
        return res.status(400).json({ error: message });
    }
    if (err && err.message === 'Error: Images Only!') {
        const message = 'فقط تصویر با فرمت JPG، PNG، GIF یا WebP قابل بارگذاری است.';
        if (req.accepts('html')) {
            return res.status(400).render('public/error', {
                title: 'خطا در ارسال فرم',
                layout: 'public/layout',
                noindex: true,
                currentPath: req.path,
                siteUrl: app.locals.siteUrl,
                errorMessage: message
            });
        }
        return res.status(400).json({ error: message });
    }
    console.error('Unhandled server error:', err);
    if (req.accepts('html')) {
        return res.status(500).render('public/error', {
            title: 'خطا در بارگذاری صفحه',
            noindex: true,
            layout: 'public/layout',
            currentPath: req.path,
            siteUrl: app.locals.siteUrl,
            errorMessage: 'مشکلی در اجرای درخواست رخ داده است.'
        });
    }
    return res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
