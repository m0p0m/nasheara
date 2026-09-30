const Product = require('../models/product');
const Category = require('../models/category');
const upload = require('../middleware/upload');
const { deleteUploadFileSafe, isSafeUploadPath } = upload;
const fs = require('fs').promises;
const path = require('path');
const { Prisma } = require('@prisma/client');
const { SHAPES, KINDS, isShape, isKind, parseVariants } = require('../lib/tileShapes');
const videoLib = require('../lib/video');

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

// Colour cut-outs posted by the admin cut-out tool as JSON [{ label, cutout }].
// Only files the tool uploaded (tileCutout-…) or ones this product already
// uses are accepted, so a variant can never point at (and later delete) an
// unrelated upload.
const variantsFromBody = (body, existing = null) => {
    if (body.tileVariants === undefined) return undefined;
    const owned = new Set(existing ? parseVariants(existing.tileVariants, existing.tileCutout).map(v => v.cutout) : []);
    return parseVariants(body.tileVariants)
        .filter(v => isSafeUploadPath(v.cutout) && (v.cutout.startsWith('/uploads/tileCutout-') || owned.has(v.cutout)))
        .slice(0, 40);
};

const visualizerFields = async (body, files, existing = null) => {
    const cutout = await cutoutUpload(files);
    const fields = {
        tileShape: isShape(body.tileShape) ? body.tileShape : null,
        tileKind: isKind(body.tileKind) ? body.tileKind : null,
        tileWidthCm: normalizeCm(body.tileWidthCm),
        tileHeightCm: normalizeCm(body.tileHeightCm),
        ...(cutout ? { tileCutout: cutout } : {})
    };
    const variants = variantsFromBody(body, existing);
    if (variants !== undefined) {
        if (cutout && !variants.length) variants.push({ label: '', cutout });
        fields.tileVariants = variants.length ? variants : Prisma.DbNull;
        fields.tileCutout = variants.length ? variants[0].cutout : null;
    }
    return fields;
};

// POST /admin/products/cutout — the cut-out tool uploads each generated PNG here
// and keeps the returned path in the form's tileVariants field until saving.
const uploadCutout = async (req, res) => {
    const cutout = await cutoutUpload(req.files);
    if (!cutout) return res.status(400).json({ ok: false, error: 'PNG/WebP required' });
    res.json({ ok: true, path: cutout });
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

    // Accept simple line-based key:value entries (e.g. "ولتاژ:20\nتوان:100W").
    // Entries are separated by newlines or semicolons. A comma only starts a new
    // entry when the text after it has its own "key:", so lists such as
    // "رنگ: سفید، سبز، مشکی" keep every item.
    const result = {};
    let lastKey = null;
    for (const line of s.split(/\r?\n|;|؛/)) {
        lastKey = null;
        for (const piece of line.split(/(?<=[,،])/)) {
            // split on first colon (either ASCII or fullwidth)
            const idx = piece.indexOf(':') >= 0 ? piece.indexOf(':') : piece.indexOf('：');
            const key = idx > 0 ? piece.slice(0, idx).trim() : '';
            if (key && !/[,،]/.test(key)) {
                lastKey = key;
                result[key] = piece.slice(idx + 1);
            } else if (lastKey) {
                result[lastKey] += piece;
            }
        }
    }
    for (const key of Object.keys(result)) result[key] = result[key].trim().replace(/[,،]$/, '').trim();
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
            tileKinds: KINDS,
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
        const { video } = videoLib.fromForm(req.body, req.files, null);
        if (video) newProduct.video = video;

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
            tileKinds: KINDS,
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
            ...(await visualizerFields(req.body, req.files, existingProduct))
        };
        const oldVariants = parseVariants(existingProduct.tileVariants, existingProduct.tileCutout);
        if (updatedData.tileVariants !== undefined) {
            // Delete cut-outs the admin removed from the colour list.
            const kept = new Set(parseVariants(updatedData.tileVariants === Prisma.DbNull ? null : updatedData.tileVariants).map(v => v.cutout));
            for (const v of oldVariants) if (!kept.has(v.cutout)) await deleteUploadFileSafe(v.cutout);
        } else if (updatedData.tileCutout && existingProduct.tileCutout && isSafeUploadPath(existingProduct.tileCutout)) {
            await deleteUploadFileSafe(existingProduct.tileCutout);
        }
        if (req.body.removeTileCutout === 'on' && updatedData.tileVariants === undefined && !updatedData.tileCutout) {
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

        // Drop gallery images the admin ticked for removal, then append new uploads
        let gallery = existingProduct.galleryImages || [];
        const removed = normalizeStringArray(req.body.removeGalleryImages).filter(p => gallery.includes(p));
        if (removed.length) {
            gallery = gallery.filter(p => !removed.includes(p));
            for (const imagePath of removed) {
                if (isSafeUploadPath(imagePath)) await deleteUploadFileSafe(imagePath);
            }
            updatedData.galleryImages = gallery;
        }
        if (req.files.galleryImages) {
             const newImages = req.files.galleryImages.map(file => '/uploads/' + file.filename);
             updatedData.galleryImages = gallery.concat(newImages);
        }

        const { video, obsolete } = videoLib.fromForm(req.body, req.files, existingProduct.video);
        updatedData.video = video || Prisma.DbNull;
        for (const file of obsolete) await deleteUploadFileSafe(file);

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

        for (const v of parseVariants(product.tileVariants, product.tileCutout)) await deleteUploadFileSafe(v.cutout);
        const oldVideo = videoLib.normalize(product.video);
        for (const file of [oldVideo.clip, oldVideo.poster]) if (file) await deleteUploadFileSafe(file);

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
    uploadCutout,
    normalizeSpecs,
};
