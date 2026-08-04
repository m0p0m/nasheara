const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const slugify = require('../utils/slugify');

const uniqueSlug = async (value, excludedId = null) => {
    const base = slugify(value);
    let candidate = base;
    let suffix = 2;
    while (await prisma.article.findFirst({ where: { slug: candidate, ...(excludedId ? { id: { not: excludedId } } : {}) } })) {
        candidate = `${base}-${suffix++}`;
    }
    return candidate;
};

const getAll = () => prisma.article.findMany({ orderBy: { createdAt: 'desc' } });
const findById = id => prisma.article.findUnique({ where: { id } });
const findBySlug = slug => prisma.article.findUnique({ where: { slug: slugify(slug) } });

const create = async input => prisma.article.create({
    data: {
        id: uuidv4(), title: input.title, slug: await uniqueSlug(input.slug || input.title),
        content: input.content || '', excerpt: input.excerpt || null,
        metaTitle: input.metaTitle || null, metaDescription: input.metaDescription || null,
        metaKeywords: input.metaKeywords || null, published: Boolean(input.published),
        mainImage: input.mainImage || null,
        galleryImages: Array.isArray(input.galleryImages) ? input.galleryImages : [],
        createdAt: input.createdAt ? new Date(input.createdAt) : new Date(),
        updatedAt: input.updatedAt ? new Date(input.updatedAt) : new Date()
    }
});

const update = async (id, input) => {
    const current = await findById(id);
    if (!current) return null;
    const data = {};
    for (const field of ['title', 'content', 'excerpt', 'metaTitle', 'metaDescription', 'metaKeywords', 'published', 'mainImage', 'galleryImages']) {
        if (Object.prototype.hasOwnProperty.call(input, field)) data[field] = input[field];
    }
    if (Object.prototype.hasOwnProperty.call(input, 'slug') || input.title) {
        data.slug = await uniqueSlug(input.slug || input.title || current.title, id);
    }
    return prisma.article.update({ where: { id }, data });
};

const remove = async id => {
    const result = await prisma.article.deleteMany({ where: { id } });
    return result.count ? undefined : null;
};

const getPublished = limit => prisma.article.findMany({
    where: { published: true }, orderBy: { createdAt: 'desc' }, ...(limit ? { take: limit } : {})
});

module.exports = { getAll, findById, findBySlug, create, update, remove, getPublished };
