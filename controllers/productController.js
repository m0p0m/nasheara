const Product = require('../models/product');
const Category = require('../models/category');
const upload = require('../middleware/upload');
const { deleteUploadFileSafe, isSafeUploadPath } = upload;
const fs = require('fs').promises;
const path = require('path');
const { SHAPES, isShape } = require('../lib/tileShapes');

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

const normalizeCm = value => {
    const n = parseFloat(String(value ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(',', '.'));
    return Number.isFinite(n) && n > 0 && n < 500 ? n : null;
};

// The cut-out must keep its alpha channel, so only PNG/WebP are stored; any
// other upload is discarded so a JPEG never ends up tiled as a rectangle.
const cutoutUpload = async files => {
    const file = files && files.tileCutout && files.tileCutout[0];
    if (!file) return null;
    if (/image\/(png|webp)/.test(file.mimetype || '')) return '/uploads/' + file.filename;
    await deleteUploadFileSafe('/uploads/' + file.filename);
    return null;
};

const visualizerFields = async (body, files) => {
    const cutout = await cutoutUpload(files);
    return {
        tileShape: isShape(body.tileShape) ? body.tileShape : null,
        tileWidthCm: normalizeCm(body.tileWidthCm),
        tileHeightCm: normalizeCm(body.tileHeightCm),
        ...(cutout ? { tileCutout: cutout } : {})
    };
};
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

// Display list of all products (paged, filtered in the database)
const PAGE_SIZE = 20;
const listProducts = async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        const categoryId = (req.query.category || '').trim() || null;
        const page = parseInt(req.query.page, 10) || 1;
        const [listing, categories] = await Promise.all([
            Product.listPage({ q, categoryId, page, pageSize: PAGE_SIZE }),
            Category.getAll()
        ]);
        const buildQuery = overrides => {
            const params = new URLSearchParams();
            const merged = { q, category: categoryId || '', page: listing.page, ...overrides };
            if (merged.q) params.set('q', merged.q);
            if (merged.category) params.set('category', merged.category);
            if (merged.page && merged.page > 1) params.set('page', merged.page);
            const str = params.toString();
            return `/admin/products${str ? `?${str}` : ''}`;
        };
        res.render('admin/products/index', {
            ...listing,
            q,
            categoryId,
            categories,
            buildQuery,
            title: 'مدیریت محصولات',
            currentPage: 'dashboard',
            layout: 'admin/layout'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error reading products data');
    }
};

// Show the form for creating a new product
const showAddForm = async (req, res) => {
    try {
        const categories = await Category.getAll();
        res.render('admin/products/add', { 
            categories,
            tileShapes: SHAPES,
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
            translations: normalizedTranslations,
            ...(await visualizerFields(req.body, req.files))
        };

        await Product.create(newProduct);
        res.redirect('/admin/dashboard'); // Redirect to product list
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating product');
    }
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
            tileShapes: SHAPES,
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
            translations: normalizedTranslations,
            ...(await visualizerFields(req.body, req.files))
        };
        if (updatedData.tileCutout && existingProduct.tileCutout && isSafeUploadPath(existingProduct.tileCutout)) {
            await deleteUploadFileSafe(existingProduct.tileCutout);
        }
        if (req.body.removeTileCutout === 'on' && !updatedData.tileCutout) {
            if (existingProduct.tileCutout && isSafeUploadPath(existingProduct.tileCutout)) await deleteUploadFileSafe(existingProduct.tileCutout);
            updatedData.tileCutout = null;
        }

        // Replace main image if a new one is uploaded
        if (req.files.mainImage) {
            if (existingProduct.mainImage && isSafeUploadPath(existingProduct.mainImage)) {
                await deleteUploadFileSafe(existingProduct.mainImage);
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
};

// Handle product deletion
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Delete associated images only if they are safe in-root image resources
        if (product.mainImage && isSafeUploadPath(product.mainImage)) {
            await deleteUploadFileSafe(product.mainImage);
        }
        if (product.galleryImages && product.galleryImages.length > 0) {
            for (const imagePath of product.galleryImages) {
                if (isSafeUploadPath(imagePath)) {
                    await deleteUploadFileSafe(imagePath);
                }
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
