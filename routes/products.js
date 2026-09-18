const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const ensureAuthenticated = require('../middleware/auth');
const upload = require('../middleware/upload');
const { authorizeCsrf } = require('../middleware/csrf');
const { adminMutationLimiter } = require('../middleware/rateLimit');

// All these routes are protected and start with '/admin/products'

// GET /admin/products - List all products (will be the main dashboard)
// Note: We'll adjust the main dashboard route later to point here.
router.get('/', ensureAuthenticated, productController.listProducts);

// GET /admin/products/add - Show form to add a new product
router.get('/add', ensureAuthenticated, productController.showAddForm);

// POST /admin/products/add - Process the add form
router.post('/add', ensureAuthenticated, adminMutationLimiter, upload, authorizeCsrf, productController.addProduct);

// GET /admin/products/edit/:id - Show form to edit a product
router.get('/edit/:id', ensureAuthenticated, productController.showEditForm);

// POST /admin/products/edit/:id - Process the edit form
router.post('/edit/:id', ensureAuthenticated, adminMutationLimiter, upload, authorizeCsrf, productController.editProduct);

// POST /admin/products/delete/:id - Delete a product
router.post('/delete/:id', ensureAuthenticated, adminMutationLimiter, authorizeCsrf, productController.deleteProduct);

module.exports = router;
