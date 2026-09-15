const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const ensureAuthenticated = require('../middleware/auth');
const upload = require('../middleware/upload');
const { authorizeCsrf } = require('../middleware/csrf');
const { adminMutationLimiter, uploadLimiter } = require('../middleware/rateLimit');

// Admin routes
router.get('/', ensureAuthenticated, articleController.listArticles);
router.get('/add', ensureAuthenticated, articleController.showAddForm);
const handleUploadImage = (req, res, next) => {
    upload(req, res, err => {
        if (err) return res.status(400).json({ error: 'بارگذاری تصویر ناموفق بود.' });
        next();
    });
};

router.post('/upload-image', ensureAuthenticated, uploadLimiter, handleUploadImage, authorizeCsrf, articleController.uploadInlineImage);
router.post('/add', ensureAuthenticated, uploadLimiter, adminMutationLimiter, upload, authorizeCsrf, articleController.addArticle);
router.get('/edit/:id', ensureAuthenticated, articleController.showEditForm);
router.post('/edit/:id', ensureAuthenticated, uploadLimiter, adminMutationLimiter, upload, authorizeCsrf, articleController.updateArticle);
router.post('/delete/:id', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, articleController.deleteArticle);

module.exports = router;
