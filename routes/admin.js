const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminSubscriberController = require('../controllers/adminSubscriberController');
const ensureAuthenticated = require('../middleware/auth');
const { authorizeCsrf } = require('../middleware/csrf');
const { loginLimiter, adminMutationLimiter } = require('../middleware/rateLimit');

router.get('/login', adminController.getLogin);
router.post('/login', loginLimiter, authorizeCsrf, adminController.postLogin);
router.post('/logout', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, adminController.getLogout);

// Subscriber routes
router.get('/subscribers', ensureAuthenticated, adminSubscriberController.listSubscribers);
router.post('/subscribers/delete/:id', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, adminSubscriberController.deleteSubscriber);

module.exports = router;
