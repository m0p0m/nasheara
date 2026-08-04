const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const ensureAuthenticated = require('../middleware/auth');

// All these routes are protected and start with '/admin/categories'

// GET /admin/categories - List all categories
router.get('/', ensureAuthenticated, categoryController.listCategories);

// GET /admin/categories/add - Show form to add a new category
router.get('/add', ensureAuthenticated, categoryController.showAddForm);

// POST /admin/categories/add - Process the add form
router.post('/add', ensureAuthenticated, categoryController.addCategory);

// GET /admin/categories/edit/:id - Show form to edit a category
router.get('/edit/:id', ensureAuthenticated, categoryController.showEditForm);

// POST /admin/categories/edit/:id - Process the edit form
router.post('/edit/:id', ensureAuthenticated, categoryController.editCategory);

// POST /admin/categories/delete/:id - Delete a category
router.post('/delete/:id', ensureAuthenticated, categoryController.deleteCategory);

module.exports = router;
