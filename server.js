require('dotenv').config();
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { i18next, middleware: i18nMiddleware, supportedLocales } = require('./config/i18n');

const ensurePublicPermissions = () => {
    const publicDir = path.join(__dirname, 'public');

    if (!fs.existsSync(publicDir)) {
        return;
    }

    const walk = (dirPath) => {
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                try {
                    fs.chmodSync(fullPath, 0o755);
                    walk(fullPath);
                } catch (error) {
                    console.warn(`Unable to chmod directory: ${fullPath}`, error.message);
                }
            } else {
                try {
                    fs.chmodSync(fullPath, 0o644);
                } catch (error) {
                    console.warn(`Unable to chmod file: ${fullPath}`, error.message);
                }
            }
        }
    };

    try {
        fs.chmodSync(publicDir, 0o755);
        walk(publicDir);
    } catch (error) {
        console.warn('Unable to normalize public permissions:', error.message);
    }
};

ensurePublicPermissions();

const app = express();
app.set('trust proxy', 1); // Trust first proxy (required on cPanel with Apache/LiteSpeed reverse proxy)
const PORT = process.env.PORT || 3001;
app.locals.siteUrl = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// MIME type mapping for common font/static file extensions
const mimeTypes = {
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon'
};

app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (mimeTypes[ext]) {
            res.setHeader('Content-Type', mimeTypes[ext]);
        }
        if (['.woff', '.woff2', '.ttf', '.eot', '.otf'].includes(ext)) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

const sessionSecret = process.env.SESSION_SECRET || 'nashearawhter_default_secret';
if (!process.env.SESSION_SECRET) {
    console.warn('SESSION_SECRET is not set. Using fallback session secret. Please configure SESSION_SECRET in .env or host environment.');
}

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
    user: dbUrl.username,
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ''),
    createDatabaseTable: true,  // Auto-create the sessions table on first run
    clearExpired: true,
    checkExpirationInterval: 900000, // Check for expired sessions every 15 min
    expiration: 7 * 24 * 60 * 60 * 1000 // 7 days (matches cookie maxAge)
};
const sessionStore = new MySQLStore(sessionStoreOptions);

app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Will be dynamically set per-request below for cPanel HTTPS support
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

// Dynamically set cookie.secure per-request based on x-forwarded-proto header.
// This MUST run after session() but before route handlers so the cookie is
// correctly marked secure when behind cPanel's HTTPS reverse proxy.
app.use((req, res, next) => {
    if (req.session && req.session.cookie) {
        req.session.cookie.secure = isSecureProxy(req);
    }
    next();
});

app.use(i18nMiddleware.handle(i18next));
app.use((req, res, next) => {
    const firstSegment = req.path.split('/').filter(Boolean)[0];
    const locale = supportedLocales.includes(firstSegment) ? firstSegment : 'fa';
    const pathWithoutLocale = supportedLocales.includes(firstSegment)
        ? (req.originalUrl.replace(new RegExp(`^/${firstSegment}(?=/|$)`), '') || '/')
        : req.originalUrl;
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
app.get('/', (req, res) => res.redirect(302, '/fa/'));
app.get('/sitemap.xml', publicController.getSitemap);
app.get('/robots.txt', publicController.getRobots);
app.use((req, res, next) => {
    const isLegacyPublicPath = /^\/(products|projects|articles|contact|consultation)(\/|$)/.test(req.path)
        || /^\/(product|project|article)\//.test(req.path);
    if (req.method === 'GET' && isLegacyPublicPath) return res.redirect(302, `/fa${req.originalUrl}`);
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
app.post('/admin/consultations/mark/:phone', ensureAuthenticated, consultationController.markContacted);
app.post('/admin/consultations/mark-id/:id', ensureAuthenticated, consultationController.markContactedById);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
