const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const slugify = require('../utils/slugify');
const { buildTranslations, localizeRecord } = require('../utils/translations');

const TRANSLATABLE_FIELDS = [
    'name', 'description', 'metaTitle', 'metaDescription', 'keywords', 'patternName',
    'color', 'material', 'dimensions', 'usageArea', 'specs'
];

const toProduct = (record, locale = 'fa') => {
    if (!record) return record;
    const { categoryRecord, categoryId, projects, ...product } = record;
    const localized = localizeRecord(product, TRANSLATABLE_FIELDS, locale);
    const localizedCategory = categoryRecord
        ? localizeRecord(categoryRecord, ['name', 'description'], locale)
        : null;
    return { ...localized, category: localizedCategory ? localizedCategory.name : null };
};

const uniqueSlug = async (value, excludedId = null) => {
    const base = slugify(value);
    let candidate = base;
    let suffix = 2;
    while (await prisma.product.findFirst({
        where: { slug: candidate, ...(excludedId ? { id: { not: excludedId } } : {}) },
        select: { id: true }
    })) {
        candidate = `${base}-${suffix++}`;
    }
    return candidate;
};

const categoryIdFor = async categoryName => {
    if (!categoryName) return null;
    let category = await prisma.category.findUnique({ where: { name: categoryName } });
    if (!category) {
        let slug = slugify(categoryName);
        let suffix = 2;
        while (await prisma.category.findUnique({ where: { slug } })) slug = `${slugify(categoryName)}-${suffix++}`;
        category = await prisma.category.create({ data: { id: uuidv4(), name: categoryName, slug } });
    }
    return category.id;
};

const productData = async (input, current = null) => {
    const data = {};
    const scalarFields = [
        'name', 'stock', 'description', 'mainImage', 'metaTitle', 'metaDescription',
        'isNew', 'isBestSeller', 'patternName', 'color', 'material', 'dimensions'
    ];
    for (const field of scalarFields) if (Object.prototype.hasOwnProperty.call(input, field)) data[field] = input[field];
    for (const field of ['galleryImages', 'keywords', 'usageArea']) {
        if (Object.prototype.hasOwnProperty.call(input, field)) data[field] = Array.isArray(input[field]) ? input[field] : [];
    }
    if (Object.prototype.hasOwnProperty.call(input, 'specs')) data.specs = input.specs && typeof input.specs === 'object' ? input.specs : {};
    if (Object.prototype.hasOwnProperty.call(input, 'category')) data.categoryId = await categoryIdFor(input.category);
    if (!current) {
        data.galleryImages ??= [];
        data.keywords ??= [];
        data.usageArea ??= [];
        data.specs ??= {};
        data.isNew ??= false;
        data.isBestSeller ??= false;
    }
    const translations = buildTranslations(input, TRANSLATABLE_FIELDS, current ? current.translations : {});
    data.translations = translations;
    const fa = translations.fa || {};
    for (const field of TRANSLATABLE_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(fa, field)) continue;
        if (['keywords', 'usageArea'].includes(field)) data[field] = Array.isArray(fa[field]) ? fa[field] : [];
        else if (field === 'specs') data.specs = fa.specs && typeof fa.specs === 'object' ? fa.specs : {};
        else data[field] = fa[field] || null;
    }
    return data;
};

const getAll = async (locale = 'fa') => (await prisma.product.findMany({ include: { categoryRecord: true } })).map(record => toProduct(record, locale));

const findById = async (id, locale = 'fa') => toProduct(await prisma.product.findUnique({ where: { id }, include: { categoryRecord: true } }), locale);

const findBySlug = async (slug, locale = 'fa') => toProduct(await prisma.product.findUnique({
    where: { slug: slugify(slug) }, include: { categoryRecord: true }
}), locale);

const create = async input => {
    const slug = await uniqueSlug(input.slug || input.name || input.translations?.fa?.name);
    const record = await prisma.product.create({
        data: { id: uuidv4(), ...(await productData(input)), slug },
        include: { categoryRecord: true }
    });
    return toProduct(record, input.locale || 'fa');
};

const update = async (id, input) => {
    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) return null;
    const hasSlug = Object.prototype.hasOwnProperty.call(input, 'slug');
    const slug = hasSlug
        ? await uniqueSlug(input.slug || input.name || current.name, id)
        : current.slug;
    const record = await prisma.product.update({
        where: { id }, data: { ...(await productData(input, current)), slug }, include: { categoryRecord: true }
    });
    return toProduct(record, input.locale || 'fa');
};

const remove = async id => {
    const result = await prisma.product.deleteMany({ where: { id } });
    return result.count ? undefined : null;
};

module.exports = { getAll, findById, findBySlug, create, update, remove, slugify };
