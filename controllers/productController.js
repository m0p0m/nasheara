const Product = require('../models/product');
const Category = require('../models/category');
const upload = require('../middleware/upload');
const fs = require('fs').promises;
const path = require('path');

const normalizeStock = (value) => {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (trimmed === '') return null;
    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const normalizeStringArray = (value) => {
    if (!value) return [];
    const values = Array.isArray(value) ? value : String(value).split(/[,،]/);
    return values
        .map(item => String(item).trim())
        .filter(Boolean);
};

const normalizeKeywords = (keywords) => normalizeStringArray(keywords);
const normalizeUsageArea = (usageArea) => normalizeStringArray(usageArea);

const normalizeTranslations = translations => {
    const result = {};
    for (const locale of ['fa', 'en', 'ar']) {
        const value = translations && translations[locale] ? translations[locale] : {};
        result[locale] = {
            ...value,
            keywords: normalizeKeywords(value.keywords),
            usageArea: normalizeUsageArea(value.usageArea),
            specs: normalizeSpecs(value.specs)
        };
    }
    return result;
};

const normalizeSpecs = (specs) => {
    if (!specs) return {};
    if (typeof specs === 'object') return specs;

    const s = String(specs).trim();
    // If it looks like JSON, try parsing
    if (s.startsWith('{') || s.startsWith('[')) {
        try {
            const parsed = JSON.parse(s);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch (error) {
            console.warn('Invalid specs JSON provided:', error);
            // fallthrough to try line-based parsing
        }
    }

    // Accept simple line-based key:value entries (e.g. "ولتاژ:20\nتوان:100W")
    const result = {};
    // Split by newlines and common separators (newline, comma, Persian comma, semicolon)
    const parts = s.split(/\r?\n|,|،|;|؛/).map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
        // split on first colon (either ASCII or fullwidth)
        const idx = part.indexOf(':') >= 0 ? part.indexOf(':') : part.indexOf('：');
        if (idx > 0) {
            const key = part.slice(0, idx).trim();
            const value = part.slice(idx + 1).trim();
            if (key) result[key] = value;
        }
    }
    return result;
};

// Display list of all products
const listProducts = async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        const all = await Product.getAll();
        const products = q
            ? all.filter(p =>
                [p.name, p.description, p.category]
                    .filter(Boolean)
                    .some(v => String(v).toLowerCase().includes(q.toLowerCase()))
              )
            : all;
        res.render('admin/products/index', { 
            products,
            q,
            title: 'مدیریت محصولات',
            currentPage: 'dashboard',
            layout: 'admin/layout'
        });
    } catch (error) {
        res.status(500).send('Error reading products data');
    }
};

// Show the form for creating a new product
const showAddForm = async (req, res) => {
    try {
        const categories = await Category.getAll();
        res.render('admin/products/add', { 
            categories, 
            title: 'افزودن محصول جدید',
            currentPage: 'dashboard',
            layout: 'admin/layout'
        });
    } catch (error) {
        res.status(500).send('Error loading categories');
    }
};

// Process the form to create a new product
const addProduct = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).send(`Error uploading files: ${err}`);
        }

        try {
            const {
                name, slug, category, stock, description, patternName, color, material,
                dimensions, usageArea, metaTitle, metaDescription, keywords, isNew,
                isBestSeller, specs, translations
            } = req.body;
            const normalizedTranslations = normalizeTranslations(translations);
            const fa = normalizedTranslations.fa;

            const mainImage = req.files.mainImage ? '/uploads/' + req.files.mainImage[0].filename : null;
            const galleryImages = req.files.galleryImages ? req.files.galleryImages.map(file => '/uploads/' + file.filename) : [];

            const newProduct = {
                name: fa.name || name,
                slug,
                category,
                stock: normalizeStock(stock),
                description: fa.description || description,
                patternName: fa.patternName || patternName,
                color: fa.color || color,
                material: fa.material || material,
                dimensions: fa.dimensions || dimensions,
                usageArea: fa.usageArea.length ? fa.usageArea : normalizeUsageArea(usageArea),
                mainImage,
                galleryImages,
                metaTitle: fa.metaTitle || metaTitle,
                metaDescription: fa.metaDescription || metaDescription,
                keywords: fa.keywords.length ? fa.keywords : normalizeKeywords(keywords),
                isNew: Boolean(isNew),
                isBestSeller: Boolean(isBestSeller),
                specs: Object.keys(fa.specs).length ? fa.specs : normalizeSpecs(specs),
                translations: normalizedTranslations
            };

            await Product.create(newProduct);
            res.redirect('/admin/dashboard'); // Redirect to product list
        } catch (error) {
            console.error(error);
            res.status(500).send('Error creating product');
        }
    });
};

// Show the form for editing an existing product
const showEditForm = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        const categories = await Category.getAll();
        if (!product) {
            return res.status(404).send('Product not found');
        }
        res.render('admin/products/edit', { 
            product, 
            categories, 
            title: 'ویرایش محصول',
            currentPage: 'dashboard',
            layout: 'admin/layout'
        });
    } catch (error) {
        res.status(500).send('Error finding product');
    }
};

// Process the form to update a product
const editProduct = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).send(`Error uploading files: ${err}`);
        }

        try {
            const existingProduct = await Product.findById(req.params.id);
            if (!existingProduct) {
                return res.status(404).send('Product not found');
            }

            const {
                name, slug, category, stock, description, patternName, color, material,
                dimensions, usageArea, metaTitle, metaDescription, keywords, isNew,
                isBestSeller, specs, translations
            } = req.body;
            const normalizedTranslations = normalizeTranslations(translations);
            const fa = normalizedTranslations.fa;

            const updatedData = {
                name: fa.name || name,
                slug,
                category,
                stock: normalizeStock(stock),
                description: fa.description || description,
                patternName: fa.patternName || patternName,
                color: fa.color || color,
                material: fa.material || material,
                dimensions: fa.dimensions || dimensions,
                usageArea: fa.usageArea.length ? fa.usageArea : normalizeUsageArea(usageArea),
                metaTitle: fa.metaTitle || metaTitle,
                metaDescription: fa.metaDescription || metaDescription,
                keywords: fa.keywords.length ? fa.keywords : normalizeKeywords(keywords),
                isNew: Boolean(isNew),
                isBestSeller: Boolean(isBestSeller),
                specs: Object.keys(fa.specs).length ? fa.specs : normalizeSpecs(specs),
                translations: normalizedTranslations
            };

            // Replace main image if a new one is uploaded
            if (req.files.mainImage) {
                if (existingProduct.mainImage) {
                    await fs.unlink(path.join(__dirname, '..', 'public', existingProduct.mainImage)).catch(console.error);
                }
                updatedData.mainImage = '/uploads/' + req.files.mainImage[0].filename;
            }

            // Add to gallery images if new ones are uploaded
            if (req.files.galleryImages) {
                 const newImages = req.files.galleryImages.map(file => '/uploads/' + file.filename);
                 updatedData.galleryImages = (existingProduct.galleryImages || []).concat(newImages);
            }

            await Product.update(req.params.id, updatedData);
            res.redirect('/admin/dashboard');
        } catch (error) {
            console.error(error);
            res.status(500).send('Error updating product');
        }
    });
};

// Handle product deletion
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Delete associated images
        if (product.mainImage) {
            await fs.unlink(path.join(__dirname, '..', 'public', product.mainImage)).catch(console.error);
        }
        if (product.galleryImages && product.galleryImages.length > 0) {
            for (const imagePath of product.galleryImages) {
                 await fs.unlink(path.join(__dirname, '..', 'public', imagePath)).catch(console.error);
            }
        }

        await Product.remove(req.params.id);
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting product');
    }
};

module.exports = {
    listProducts,
    showAddForm,
    addProduct,
    showEditForm,
    editProduct,
    deleteProduct,
};
