const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const ensureAuthenticated = require('../middleware/auth');
const upload = require('../middleware/upload');

// Admin routes
router.get('/', ensureAuthenticated, articleController.listArticles);
router.get('/add', ensureAuthenticated, articleController.showAddForm);
router.post('/add', ensureAuthenticated, upload, articleController.addArticle);
router.get('/edit/:id', ensureAuthenticated, articleController.showEditForm);
router.post('/edit/:id', ensureAuthenticated, upload, articleController.updateArticle);
router.post('/delete/:id', ensureAuthenticated, articleController.deleteArticle);

module.exports = router;

