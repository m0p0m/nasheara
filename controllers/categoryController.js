const Category = require('../models/category');
const upload = require('../middleware/upload');
const fs = require('fs').promises;
const path = require('path');

// Display list of all categories
const listCategories = async (req, res) => {
    try {
        const categories = await Category.getAll();
        res.render('admin/categories/index', { 
            categories, 
            title: 'Manage Categories',
            currentPage: 'categories',
            layout: 'admin/layout'
        });
    } catch (error) {
        // In a real app, you'd want better error handling
        res.status(500).send('Error reading categories data');
    }
};

// Show the form for creating a new category
const showAddForm = (req, res) => {
    res.render('admin/categories/add', { 
        title: 'Add New Category',
        currentPage: 'categories',
        layout: 'admin/layout'
    });
};

// Process the form to create a new category
const addCategory = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).send(`Error uploading files: ${err}`);
        }

        try {
            const { name, description } = req.body;
            const mainImage = req.files && req.files.mainImage ? '/uploads/' + req.files.mainImage[0].filename : null;

            await Category.create({ name, description, mainImage });
            res.redirect('/admin/categories');
        } catch (error) {
            console.error(error);
            res.status(500).send('Error creating category');
        }
    });
};

// Show the form for editing an existing category
const showEditForm = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).send('Category not found');
        }
        res.render('admin/categories/edit', { 
            category, 
            title: 'Edit Category',
            currentPage: 'categories',
            layout: 'admin/layout'
        });
    } catch (error) {
        res.status(500).send('Error finding category');
    }
};

// Process the form to update a category
const editCategory = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).send(`Error uploading files: ${err}`);
        }

        try {
            const existing = await Category.findById(req.params.id);
            if (!existing) return res.status(404).send('Category not found');

            const { name, description } = req.body;
            const updatedData = { name, description };

            // Replace main image if a new one is uploaded
            if (req.files && req.files.mainImage) {
                if (existing.mainImage) {
                    await fs.unlink(path.join(__dirname, '..', 'public', existing.mainImage)).catch(() => {});
                }
                updatedData.mainImage = '/uploads/' + req.files.mainImage[0].filename;
            }

            await Category.update(req.params.id, updatedData);
            res.redirect('/admin/categories');
        } catch (error) {
            console.error(error);
            res.status(500).send('Error updating category');
        }
    });
};

// Handle category deletion
const deleteCategory = async (req, res) => {
    try {
        await Category.remove(req.params.id);
        res.redirect('/admin/categories');
    } catch (error) {
        res.status(500).send('Error deleting category');
    }
};


module.exports = {
    listCategories,
    showAddForm,
    addCategory,
    showEditForm,
    editCategory,
    deleteCategory
};
