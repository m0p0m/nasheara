const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminSubscriberController = require('../controllers/adminSubscriberController');
const adminTestimonialController = require('../controllers/adminTestimonialController');
const adminSceneController = require('../controllers/adminSceneController');
const upload = require('../middleware/upload');
const ensureAuthenticated = require('../middleware/auth');
const { authorizeCsrf } = require('../middleware/csrf');
const { loginLimiter, adminMutationLimiter } = require('../middleware/rateLimit');

router.get('/login', adminController.getLogin);
router.post('/login', loginLimiter, authorizeCsrf, adminController.postLogin);
router.post('/logout', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, adminController.getLogout);

// Subscriber routes
router.get('/subscribers', ensureAuthenticated, adminSubscriberController.listSubscribers);
router.post('/subscribers/delete/:id', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, adminSubscriberController.deleteSubscriber);

// Testimonial routes
router.get('/testimonials', ensureAuthenticated, adminTestimonialController.list);
router.post('/testimonials/add', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, adminTestimonialController.create);
router.get('/testimonials/edit/:id', ensureAuthenticated, adminTestimonialController.showEdit);
router.post('/testimonials/edit/:id', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, adminTestimonialController.update);
router.post('/testimonials/toggle/:id', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, adminTestimonialController.toggle);
router.post('/testimonials/delete/:id', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, adminTestimonialController.remove);

// Visualizer scene routes
router.get('/scenes', ensureAuthenticated, adminSceneController.list);
router.post('/scenes/add', ensureAuthenticated, adminMutationLimiter, upload, authorizeCsrf, adminSceneController.create);
router.get('/scenes/edit/:id', ensureAuthenticated, adminSceneController.showEdit);
router.post('/scenes/edit/:id', ensureAuthenticated, adminMutationLimiter, upload, authorizeCsrf, adminSceneController.update);
router.post('/scenes/toggle/:id', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, adminSceneController.toggle);
router.post('/scenes/delete/:id', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, adminSceneController.remove);

module.exports = router;
