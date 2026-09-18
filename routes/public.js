const express = require('express');
const router = express.Router();
const consultationController = require('../controllers/consultationController');
const publicController = require('../controllers/publicController');
const newsletterController = require('../controllers/newsletterController');
const { authorizeCsrf } = require('../middleware/csrf');
const { consultationLimiter, newsletterLimiter } = require('../middleware/rateLimit');

// GET / - Show the home page
router.get('/', publicController.getHomePage);

// GET /products - Show all products page
router.get('/products', publicController.getAllProducts);

// GET /product/:slug - Show product detail page
router.get('/product/:slug', publicController.getProductDetail);

router.get('/projects', publicController.getAllProjects);
router.get('/project/:slug', publicController.getProjectDetail);

// GET /articles - Show all articles
router.get('/articles', require('../controllers/articleController').getAllArticles);

// GET /article/:slug - Show article detail
router.get('/article/:slug', require('../controllers/articleController').getArticleDetail);

router.get('/sitemap.xml', publicController.getSitemap);
router.get('/robots.txt', publicController.getRobots);

// GET /contact - Show contact page
router.get('/contact', publicController.getContactPage);

// GET /visualizer - Room visualizer (tool lands here in the next iteration)
router.get('/visualizer', publicController.getVisualizerPage);

// GET /consultation - Show the consultation form
router.get('/consultation', consultationController.showConsultationForm);

// POST /consultation - Handle the form submission
router.post('/consultation', consultationLimiter, authorizeCsrf, consultationController.submitConsultation);

// POST /newsletter/subscribe - Handle newsletter subscription
router.post('/newsletter/subscribe', newsletterLimiter, authorizeCsrf, newsletterController.subscribe);

module.exports = router;
