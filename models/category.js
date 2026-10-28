const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const slugify = require('../utils/slugify');
const { buildTranslations, localizeRecord } = require('../utils/translations');

const uniqueSlug = async (value, excludedId = null) => {
    const base = slugify(value);
    let candidate = base;
    let suffix = 2;
    while (await prisma.category.findFirst({ where: { slug: candidate, ...(excludedId ? { id: { not: excludedId } } : {}) } })) {
        candidate = `${base}-${suffix++}`;
    }
    return candidate;
};

const getAll = async (locale = 'fa') => (await prisma.category.findMany())
    .map(category => localizeRecord(category, ['name', 'description'], locale));
const findById = async (id, locale = 'fa') => localizeRecord(
    await prisma.category.findUnique({ where: { id } }), ['name', 'description'], locale
);

const findBySlug = async (slug, locale = 'fa') => localizeRecord(
    await prisma.category.findUnique({ where: { slug: slugify(slug) } }), ['name', 'description'], locale
);

const create = async input => {
    const translations = buildTranslations(input, ['name', 'description']);
    const fa = translations.fa || {};
    return prisma.category.create({ data: {
        id: uuidv4(), name: input.name, slug: await uniqueSlug(input.slug || input.name),
        description: input.description || null, mainImage: input.mainImage || null, translations
    } });
};

const update = async (id, input) => {
    const current = await prisma.category.findUnique({ where: { id } });
    if (!current) return null;
    const data = {};
    for (const field of ['name', 'description', 'mainImage']) {
        if (Object.prototype.hasOwnProperty.call(input, field)) data[field] = input[field];
    }
    if (Object.prototype.hasOwnProperty.call(input, 'slug') || input.name) {
        data.slug = await uniqueSlug(input.slug || input.name || current.name, id);
    }
    const translations = buildTranslations(input, ['name', 'description'], current.translations || {});
    data.translations = translations;
    if (translations.fa.name !== undefined) data.name = translations.fa.name;
    if (translations.fa.description !== undefined) data.description = translations.fa.description || null;
    return prisma.category.update({ where: { id }, data });
};

const remove = async id => {
    const result = await prisma.category.deleteMany({ where: { id } });
    return result.count ? undefined : null;
};

module.exports = { getAll: cache.wrap('category.getAll', getAll), findById, findBySlug, create, update, remove };
