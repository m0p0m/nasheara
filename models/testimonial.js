const prisma = require('../lib/prisma');

const clampRating = value => Math.min(5, Math.max(1, parseInt(value, 10) || 5));

const normalize = input => ({
    name: String(input.name || '').trim(),
    location: String(input.location || '').trim() || null,
    text: String(input.text || '').trim(),
    rating: clampRating(input.rating),
    published: input.published === true || input.published === 'on' || input.published === 'true',
    sortOrder: parseInt(input.sortOrder, 10) || 0
});

const getPublished = (limit = 6) => prisma.testimonial.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: limit
});

const getAll = () => prisma.testimonial.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });

const findById = id => prisma.testimonial.findUnique({ where: { id } });

const create = input => prisma.testimonial.create({ data: normalize(input) });

const update = (id, input) => prisma.testimonial.update({ where: { id }, data: normalize(input) });

const setPublished = (id, published) => prisma.testimonial.update({ where: { id }, data: { published } });

const remove = id => prisma.testimonial.deleteMany({ where: { id } });

module.exports = { getPublished, getAll, findById, create, update, setPublished, remove };
