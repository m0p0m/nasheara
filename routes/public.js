const express = require('express');
const router = express.Router();
const consultationController = require('../controllers/consultationController');
const publicController = require('../controllers/publicController');
const newsletterController = require('../controllers/newsletterController');

// GET / - Show the home page
router.get('/', publicController.getHomePage);

// GET /products - Show all products page
router.get('/products', publicController.getAllProducts);

// GET /product/:slug - Show product detail page
router.get('/product/:slug', publicController.getProductDetail);

// GET /about - Show about page
router.get('/about', publicController.getAboutPage);

// GET /articles - Show all articles
router.get('/articles', require('../controllers/articleController').getAllArticles);

// GET /article/:slug - Show article detail
router.get('/article/:slug', require('../controllers/articleController').getArticleDetail);

// GET /contact - Show contact page
router.get('/contact', publicController.getContactPage);

// GET /consultation - Show the consultation form
router.get('/consultation', consultationController.showConsultationForm);

// POST /consultation - Handle the form submission
router.post('/consultation', consultationController.submitConsultation);

// POST /newsletter/subscribe - Handle newsletter subscription
router.post('/newsletter/subscribe', newsletterController.subscribe);

module.exports = router;
