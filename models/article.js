const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const slugify = require('../utils/slugify');
const { buildTranslations, localizeRecord } = require('../utils/translations');

const TRANSLATABLE_FIELDS = ['title', 'content', 'excerpt', 'metaTitle', 'metaDescription', 'metaKeywords'];

const uniqueSlug = async (value, excludedId = null) => {
    const base = slugify(value);
    let candidate = base;
    let suffix = 2;
    while (await prisma.article.findFirst({ where: { slug: candidate, ...(excludedId ? { id: { not: excludedId } } : {}) } })) {
        candidate = `${base}-${suffix++}`;
    }
    return candidate;
};

const getAll = async (locale = 'fa') => (await prisma.article.findMany({ orderBy: { createdAt: 'desc' } }))
    .map(article => localizeRecord(article, TRANSLATABLE_FIELDS, locale));
const findById = async (id, locale = 'fa') => localizeRecord(
    await prisma.article.findUnique({ where: { id } }), TRANSLATABLE_FIELDS, locale
);
const findBySlug = async (slug, locale = 'fa') => localizeRecord(
    await prisma.article.findUnique({ where: { slug: slugify(slug) } }), TRANSLATABLE_FIELDS, locale
);

const create = async input => {
    const translations = buildTranslations(input, TRANSLATABLE_FIELDS);
    const fa = translations.fa || {};
    return prisma.article.create({ data: {
        id: uuidv4(), title: fa.title || input.title, slug: await uniqueSlug(input.slug || fa.title || input.title),
        content: fa.content || input.content || '', excerpt: fa.excerpt || input.excerpt || null,
        metaTitle: fa.metaTitle || input.metaTitle || null, metaDescription: fa.metaDescription || input.metaDescription || null,
        metaKeywords: fa.metaKeywords || input.metaKeywords || null, published: Boolean(input.published),
        mainImage: input.mainImage || null,
        galleryImages: Array.isArray(input.galleryImages) ? input.galleryImages : [],
        createdAt: input.createdAt ? new Date(input.createdAt) : new Date(),
        updatedAt: input.updatedAt ? new Date(input.updatedAt) : new Date(), translations
    } });
};

const update = async (id, input) => {
    const current = await prisma.article.findUnique({ where: { id } });
    if (!current) return null;
    const data = {};
    for (const field of ['title', 'content', 'excerpt', 'metaTitle', 'metaDescription', 'metaKeywords', 'published', 'mainImage', 'galleryImages']) {
        if (Object.prototype.hasOwnProperty.call(input, field)) data[field] = input[field];
    }
    if (Object.prototype.hasOwnProperty.call(input, 'slug') || input.title) {
        data.slug = await uniqueSlug(input.slug || input.title || current.title, id);
    }
    const translations = buildTranslations(input, TRANSLATABLE_FIELDS, current.translations || {});
    data.translations = translations;
    for (const field of TRANSLATABLE_FIELDS) {
        if (translations.fa[field] !== undefined) data[field] = translations.fa[field] || (field === 'content' ? '' : null);
    }
    return prisma.article.update({ where: { id }, data });
};

const remove = async id => {
    const result = await prisma.article.deleteMany({ where: { id } });
    return result.count ? undefined : null;
};

const getPublished = async (limit = null, locale = 'fa') => (await prisma.article.findMany({
    where: { published: true }, orderBy: { createdAt: 'desc' }, ...(limit ? { take: limit } : {})
})).map(article => localizeRecord(article, TRANSLATABLE_FIELDS, locale));

module.exports = { getAll, findById, findBySlug, create, update, remove, getPublished };
