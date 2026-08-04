const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminSubscriberController = require('../controllers/adminSubscriberController');

router.get('/login', adminController.getLogin);
router.post('/login', adminController.postLogin);
router.get('/logout', adminController.getLogout);

// Subscriber routes
router.get('/subscribers', adminSubscriberController.listSubscribers);
router.post('/subscribers/delete/:id', adminSubscriberController.deleteSubscriber);

module.exports = router;
