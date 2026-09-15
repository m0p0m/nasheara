const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const ensureAuthenticated = require('../middleware/auth');
const upload = require('../middleware/upload');
const { authorizeCsrf } = require('../middleware/csrf');
const { adminMutationLimiter } = require('../middleware/rateLimit');

router.get('/', ensureAuthenticated, projectController.listProjects);
router.get('/add', ensureAuthenticated, projectController.showAddForm);
router.post('/add', ensureAuthenticated, adminMutationLimiter, upload, authorizeCsrf, projectController.addProject);
router.get('/edit/:id', ensureAuthenticated, projectController.showEditForm);
router.post('/edit/:id', ensureAuthenticated, adminMutationLimiter, upload, authorizeCsrf, projectController.editProject);
router.post('/delete/:id', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, projectController.deleteProject);

module.exports = router;
