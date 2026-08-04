const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const slugify = require('../utils/slugify');

const toProject = record => {
    if (!record) return record;
    const { relatedProducts = [], ...project } = record;
    return { ...project, relatedProductIds: relatedProducts.map(relation => relation.product.id) };
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

const getAll = async () => (await prisma.project.findMany({ include: includeProducts, orderBy: { createdAt: 'desc' } })).map(toProject);
const findById = async id => toProject(await prisma.project.findUnique({ where: { id }, include: includeProducts }));
const findBySlug = async slug => toProject(await prisma.project.findUnique({ where: { slug: slugify(slug) }, include: includeProducts }));

const create = async input => {
    const productIds = await resolveProductIds(input.relatedProductIds);
    return toProject(await prisma.project.create({
        data: {
            id: uuidv4(), title: input.title, slug: await uniqueSlug(input.slug || input.title),
            location: input.location || null, description: input.description || null,
            coverImage: input.coverImage || null,
            galleryImages: Array.isArray(input.galleryImages) ? input.galleryImages : [],
            createdAt: input.createdAt ? new Date(input.createdAt) : new Date(),
            relatedProducts: { create: productIds.map(productId => ({ product: { connect: { id: productId } } })) }
        },
        include: includeProducts
    }));
};

const update = async (id, input) => {
    const current = await prisma.project.findUnique({ where: { id } });
    if (!current) return null;
    const data = {};
    for (const field of ['title', 'location', 'description', 'coverImage', 'galleryImages']) {
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
    return toProject(await prisma.project.update({ where: { id }, data, include: includeProducts }));
};

const remove = async id => {
    const result = await prisma.project.deleteMany({ where: { id } });
    return result.count ? true : null;
};

module.exports = { getAll, findById, findBySlug, create, update, remove };
