const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const slugify = require('../utils/slugify');
const { buildTranslations, localizeRecord } = require('../utils/translations');

const TRANSLATABLE_FIELDS = ['title', 'location', 'description'];

const toProject = (record, locale = 'fa') => {
    if (!record) return record;
    const { relatedProducts = [], ...project } = record;
    return {
        ...localizeRecord(project, TRANSLATABLE_FIELDS, locale),
        relatedProductIds: relatedProducts.map(relation => relation.product.id)
    };
};

const includeProducts = { relatedProducts: { include: { product: true } } };

const uniqueSlug = async (value, excludedId = null) => {
    const base = slugify(value);
    let candidate = base;
    let suffix = 2;
    while (await prisma.project.findFirst({ where: { slug: candidate, ...(excludedId ? { id: { not: excludedId } } : {}) } })) {
        candidate = `${base}-${suffix++}`;
    }
    return candidate;
};

const resolveProductIds = async references => {
    const values = Array.isArray(references) ? references.filter(Boolean).map(String) : [];
    if (!values.length) return [];
    const products = await prisma.product.findMany({
        where: { OR: [{ id: { in: values } }, { slug: { in: values } }] },
        select: { id: true }
    });
    return [...new Set(products.map(product => product.id))];
};

const getAll = async (locale = 'fa') => (await prisma.project.findMany({ include: includeProducts, orderBy: { createdAt: 'desc' } })).map(record => toProject(record, locale));
const findById = async (id, locale = 'fa') => toProject(await prisma.project.findUnique({ where: { id }, include: includeProducts }), locale);
const findBySlug = async (slug, locale = 'fa') => toProject(await prisma.project.findUnique({ where: { slug: slugify(slug) }, include: includeProducts }), locale);

const create = async input => {
    const productIds = await resolveProductIds(input.relatedProductIds);
    const translations = buildTranslations(input, TRANSLATABLE_FIELDS);
    const fa = translations.fa || {};
    return toProject(await prisma.project.create({
        data: {
            id: uuidv4(), title: fa.title || input.title, slug: await uniqueSlug(input.slug || fa.title || input.title),
            location: fa.location || input.location || null, description: fa.description || input.description || null,
            coverImage: input.coverImage || null,
            video: input.video || undefined,
            galleryImages: Array.isArray(input.galleryImages) ? input.galleryImages : [],
            createdAt: input.createdAt ? new Date(input.createdAt) : new Date(),
            translations,
            relatedProducts: { create: productIds.map(productId => ({ product: { connect: { id: productId } } })) }
        },
        include: includeProducts
    }), input.locale || 'fa');
};

const update = async (id, input) => {
    const current = await prisma.project.findUnique({ where: { id } });
    if (!current) return null;
    const data = {};
    for (const field of ['title', 'location', 'description', 'coverImage', 'galleryImages', 'video']) {
        if (Object.prototype.hasOwnProperty.call(input, field)) data[field] = input[field];
    }
    if (Object.prototype.hasOwnProperty.call(input, 'slug')) {
        data.slug = await uniqueSlug(input.slug || input.title || current.title, id);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'relatedProductIds')) {
        const productIds = await resolveProductIds(input.relatedProductIds);
        data.relatedProducts = {
            deleteMany: {},
            create: productIds.map(productId => ({ product: { connect: { id: productId } } }))
        };
    }
    const translations = buildTranslations(input, TRANSLATABLE_FIELDS, current.translations || {});
    data.translations = translations;
    if (translations.fa.title !== undefined) data.title = translations.fa.title;
    if (translations.fa.location !== undefined) data.location = translations.fa.location || null;
    if (translations.fa.description !== undefined) data.description = translations.fa.description || null;
    return toProject(await prisma.project.update({ where: { id }, data, include: includeProducts }), input.locale || 'fa');
};

const remove = async id => {
    const result = await prisma.project.deleteMany({ where: { id } });
    return result.count ? true : null;
};

module.exports = { getAll: cache.wrap('project.getAll', getAll), findById, findBySlug, create, update, remove };
