const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const slugify = require('../utils/slugify');

const uniqueSlug = async (value, excludedId = null) => {
    const base = slugify(value);
    let candidate = base;
    let suffix = 2;
    while (await prisma.category.findFirst({ where: { slug: candidate, ...(excludedId ? { id: { not: excludedId } } : {}) } })) {
        candidate = `${base}-${suffix++}`;
    }
    return candidate;
};

const getAll = () => prisma.category.findMany();
const findById = id => prisma.category.findUnique({ where: { id } });

const create = async input => prisma.category.create({
    data: {
        id: uuidv4(), name: input.name, slug: await uniqueSlug(input.slug || input.name),
        description: input.description || null, mainImage: input.mainImage || null
    }
});

const update = async (id, input) => {
    const current = await findById(id);
    if (!current) return null;
    const data = {};
    for (const field of ['name', 'description', 'mainImage']) {
        if (Object.prototype.hasOwnProperty.call(input, field)) data[field] = input[field];
    }
    if (Object.prototype.hasOwnProperty.call(input, 'slug') || input.name) {
        data.slug = await uniqueSlug(input.slug || input.name || current.name, id);
    }
    return prisma.category.update({ where: { id }, data });
};

const remove = async id => {
    const result = await prisma.category.deleteMany({ where: { id } });
    return result.count ? undefined : null;
};

module.exports = { getAll, findById, create, update, remove };
