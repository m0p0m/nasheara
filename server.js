require('dotenv').config();
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

const Product = require('./models/product');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d'
}));
const sessionSecret = process.env.SESSION_SECRET || 'sabawhter_default_secret';
if (!process.env.SESSION_SECRET) {
    console.warn('SESSION_SECRET is not set. Using fallback session secret. Please configure SESSION_SECRET in .env or host environment.');
}
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true in production with HTTPS
}));

// Routes
const adminRoutes = require('./routes/admin');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const publicRoutes = require('./routes/public'); // New
const ensureAuthenticated = require('./middleware/auth');
const productController = require('./controllers/productController');
const consultationController = require('./controllers/consultationController'); // New

// Public routes
app.use('/', publicRoutes);

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
app.use('/admin/articles', require('./routes/articles'));

// Protected dashboard route now shows the product list
app.get('/admin/dashboard', ensureAuthenticated, productController.listProducts);

// Protected consultation list route
app.get('/admin/consultations', ensureAuthenticated, consultationController.listConsultations); // New
// Mark consultation(s) as contacted (by phone) - POST
app.post('/admin/consultations/mark/:phone', ensureAuthenticated, consultationController.markContacted);
app.post('/admin/consultations/mark-id/:id', ensureAuthenticated, consultationController.markContactedById);

app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain');
    res.send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl.replace(/\/$/, '')}/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (req, res) => {
    try {
        const baseUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
        const Article = require('./models/article');
        const staticUrls = [
            { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'weekly' },
            { loc: `${baseUrl}/products`, priority: '0.9', changefreq: 'weekly' },
            { loc: `${baseUrl}/about`, priority: '0.6', changefreq: 'monthly' },
            { loc: `${baseUrl}/contact`, priority: '0.7', changefreq: 'monthly' },
            { loc: `${baseUrl}/articles`, priority: '0.8', changefreq: 'weekly' },
            { loc: `${baseUrl}/consultation`, priority: '0.7', changefreq: 'monthly' }
        ];

        const articles = await Article.getPublished();
        const articleUrls = articles.map(article => ({
            loc: `${baseUrl}/article/${article.slug}`,
            priority: '0.7',
            changefreq: 'monthly'
        }));

        const products = await Product.getAll();
        const productUrls = products.map(product => ({
            loc: `${baseUrl}/product/${encodeURIComponent(product.slug)}`,
            priority: '0.8',
            changefreq: 'monthly'
        }));

        const urls = [...staticUrls, ...productUrls, ...articleUrls];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            urls.map(url => (
                `  <url>\n` +
                `    <loc>${url.loc}</loc>\n` +
                `    <changefreq>${url.changefreq}</changefreq>\n` +
                `    <priority>${url.priority}</priority>\n` +
                `  </url>`
            )).join('\n') +
            '\n</urlset>';

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        console.error('Failed to generate sitemap:', error);
        res.status(500).send('Cannot generate sitemap');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
