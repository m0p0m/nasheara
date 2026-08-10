require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const slugify = require('../utils/slugify');

const dataDirectory = path.join(__dirname, '..', 'data');

const readJson = async fileName => {
    try {
        const value = JSON.parse(await fs.readFile(path.join(dataDirectory, fileName), 'utf8'));
        return Array.isArray(value) ? value : [];
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

const validDate = (value, fallback = new Date()) => {
    const date = value ? new Date(value) : fallback;
    return Number.isNaN(date.getTime()) ? fallback : date;
};

const uniqueSlug = async (delegate, value, id) => {
    const base = slugify(value);
    let candidate = base;
    let suffix = 2;
    while (await delegate.findFirst({ where: { slug: candidate, id: { not: id } }, select: { id: true } })) {
        candidate = `${base}-${suffix++}`;
    }
    return candidate;
};

const migrate = async () => {
    const [categories, products, projects, articles, consultations, subscribers] = await Promise.all([
        readJson('categories.json'), readJson('products.json'), readJson('projects.json'),
        readJson('articles.json'), readJson('consultations.json'), readJson('subscribers.json')
    ]);

    for (const category of categories) {
        const id = category.id || uuidv4();
        const data = {
            name: category.name,
            slug: await uniqueSlug(prisma.category, category.slug || category.name, id),
            description: category.description || null,
            mainImage: category.mainImage || null,
            translations: category.translations || { fa: { name: category.name, description: category.description || '' }, en: {}, ar: {} }
        };
        await prisma.category.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    for (const product of products) {
        const id = product.id || uuidv4();
        let categoryId = null;
        if (product.category) {
            let category = await prisma.category.findUnique({ where: { name: product.category } });
            if (!category) {
                const newCategoryId = uuidv4();
                category = await prisma.category.create({
                    data: {
                        id: newCategoryId, name: product.category,
                        slug: await uniqueSlug(prisma.category, product.category, newCategoryId)
                    }
                });
            }
            categoryId = category.id;
        }
        const data = {
            name: product.name,
            slug: await uniqueSlug(prisma.product, product.slug || product.name, id),
            categoryId,
            stock: Number.isInteger(product.stock) ? product.stock : null,
            description: product.description || null,
            mainImage: product.mainImage || null,
            galleryImages: Array.isArray(product.galleryImages) ? product.galleryImages : [],
            metaTitle: product.metaTitle || null,
            metaDescription: product.metaDescription || null,
            keywords: Array.isArray(product.keywords) ? product.keywords : [],
            isNew: Boolean(product.isNew),
            isBestSeller: Boolean(product.isBestSeller),
            specs: product.specs && typeof product.specs === 'object' ? product.specs : {},
            patternName: product.patternName || null,
            color: product.color || null,
            material: product.material || null,
            dimensions: product.dimensions || null,
            usageArea: Array.isArray(product.usageArea) ? product.usageArea : [],
            translations: product.translations || { fa: {
                name: product.name, description: product.description || '', metaTitle: product.metaTitle || '',
                metaDescription: product.metaDescription || '', keywords: product.keywords || [],
                patternName: product.patternName || '', color: product.color || '', material: product.material || '',
                dimensions: product.dimensions || '', usageArea: product.usageArea || [], specs: product.specs || {}
            }, en: {}, ar: {} }
        };
        await prisma.product.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    for (const project of projects) {
        const id = project.id || uuidv4();
        const data = {
            title: project.title,
            slug: await uniqueSlug(prisma.project, project.slug || project.title, id),
            location: project.location || null,
            description: project.description || null,
            coverImage: project.coverImage || null,
            galleryImages: Array.isArray(project.galleryImages) ? project.galleryImages : [],
            createdAt: validDate(project.createdAt),
            translations: project.translations || { fa: {
                title: project.title, location: project.location || '', description: project.description || ''
            }, en: {}, ar: {} }
        };
        await prisma.project.upsert({ where: { id }, update: data, create: { id, ...data } });
        const references = Array.isArray(project.relatedProductIds) ? project.relatedProductIds.map(String) : [];
        const relatedProducts = references.length
            ? await prisma.product.findMany({ where: { OR: [{ id: { in: references } }, { slug: { in: references } }] }, select: { id: true } })
            : [];
        await prisma.projectProduct.deleteMany({ where: { projectId: id } });
        if (relatedProducts.length) {
            await prisma.projectProduct.createMany({
                data: relatedProducts.map(product => ({ projectId: id, productId: product.id })),
                skipDuplicates: true
            });
        }
    }

    const articleIdOccurrences = new Map();
    for (const article of articles) {
        const sourceId = article.id || `article-${slugify(article.title)}`;
        const occurrence = (articleIdOccurrences.get(sourceId) || 0) + 1;
        articleIdOccurrences.set(sourceId, occurrence);
        // Preserve duplicate JSON rows with deterministic IDs so reruns remain idempotent.
        const id = occurrence === 1 ? sourceId : `${sourceId}-duplicate-${occurrence}`;
        const data = {
            title: article.title,
            slug: await uniqueSlug(prisma.article, article.slug || article.title, id),
            content: article.content || '', excerpt: article.excerpt || null,
            metaTitle: article.metaTitle || null, metaDescription: article.metaDescription || null,
            metaKeywords: article.metaKeywords || null, published: Boolean(article.published),
            mainImage: article.mainImage || null,
            galleryImages: Array.isArray(article.galleryImages) ? article.galleryImages : [],
            createdAt: validDate(article.createdAt), updatedAt: validDate(article.updatedAt),
            translations: article.translations || { fa: {
                title: article.title, content: article.content || '', excerpt: article.excerpt || '',
                metaTitle: article.metaTitle || '', metaDescription: article.metaDescription || '',
                metaKeywords: article.metaKeywords || ''
            }, en: {}, ar: {} }
        };
        await prisma.article.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    for (const consultation of consultations) {
        const id = consultation.id || uuidv4();
        const data = {
            name: consultation.name || '', phone: consultation.phone || '',
            interestedInProduct: consultation.interestedInProduct || null,
            contactTime: consultation.contactTime || null, email: consultation.email || null,
            projectType: consultation.projectType || null, message: consultation.message || null,
            contacted: Boolean(consultation.contacted),
            createdAt: validDate(consultation.createdAt || consultation.submittedAt),
            submittedAt: consultation.submittedAt ? validDate(consultation.submittedAt) : null
        };
        await prisma.consultation.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    for (const subscriber of subscribers) {
        const id = subscriber.id || uuidv4();
        const data = { email: String(subscriber.email).trim().toLowerCase(), subscribedAt: validDate(subscriber.subscribedAt) };
        await prisma.newsletterSubscriber.upsert({ where: { email: data.email }, update: data, create: { id, ...data } });
    }

    console.log('JSON to MySQL migration completed:', {
        categories: categories.length, products: products.length, projects: projects.length,
        articles: articles.length, consultations: consultations.length, subscribers: subscribers.length
    });
};

migrate()
    .catch(error => {
        console.error('JSON to MySQL migration failed:', error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
