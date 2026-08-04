require('dotenv').config();
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
app.locals.siteUrl = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

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
