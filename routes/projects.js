const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const ensureAuthenticated = require('../middleware/auth');

router.get('/', ensureAuthenticated, projectController.listProjects);
router.get('/add', ensureAuthenticated, projectController.showAddForm);
router.post('/add', ensureAuthenticated, projectController.addProject);
router.get('/edit/:id', ensureAuthenticated, projectController.showEditForm);
router.post('/edit/:id', ensureAuthenticated, projectController.editProject);
router.post('/delete/:id', ensureAuthenticated, projectController.deleteProject);

module.exports = router;
