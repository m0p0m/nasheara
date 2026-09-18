const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');

// Corners of the tiled area as fractions of the photo, clockwise from top-left.
const DEFAULT_QUAD = [[0.1, 0.25], [0.9, 0.25], [0.9, 0.7], [0.1, 0.7]];

const clamp01 = v => Math.min(1, Math.max(0, v));

const parseQuad = value => {
    let quad = value;
    if (typeof quad === 'string') {
        try { quad = JSON.parse(quad); } catch (e) { return DEFAULT_QUAD; }
    }
    if (!Array.isArray(quad) || quad.length !== 4) return DEFAULT_QUAD;
    const points = quad.map(p => Array.isArray(p) ? [parseFloat(p[0]), parseFloat(p[1])] : [NaN, NaN]);
    if (points.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return DEFAULT_QUAD;
    return points.map(p => [clamp01(p[0]), clamp01(p[1])]);
};

const cm = (value, fallback) => {
    const n = parseFloat(String(value ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(',', '.'));
    return Number.isFinite(n) && n >= 20 && n <= 2000 ? n : fallback;
};

const fraction = (value, fallback) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
};

const flag = value => value === true || value === 'on' || value === 'true';

const normalize = (input, current = null) => ({
    name: String(input.name || '').trim(),
    nameEn: String(input.nameEn || '').trim() || null,
    nameAr: String(input.nameAr || '').trim() || null,
    quad: parseQuad(input.quad ?? (current && current.quad)),
    wallWidthCm: cm(input.wallWidthCm, current ? current.wallWidthCm : 240),
    wallHeightCm: cm(input.wallHeightCm, current ? current.wallHeightCm : 60),
    lighting: fraction(input.lighting, current ? current.lighting : 0.8),
    sortOrder: parseInt(input.sortOrder, 10) || 0,
    isActive: flag(input.isActive)
});

const getActive = () => prisma.visualizerScene.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
});

const getAll = () => prisma.visualizerScene.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });

const findById = id => prisma.visualizerScene.findUnique({ where: { id } });

const create = (input, image) => prisma.visualizerScene.create({
    data: { id: uuidv4(), ...normalize(input), image }
});

// `files` carries the resolved upload columns (image / overlay) decided by the controller.
const update = (id, input, current, files = {}) => prisma.visualizerScene.update({
    where: { id },
    data: { ...normalize(input, current), ...files }
});

const setActive = (id, isActive) => prisma.visualizerScene.update({ where: { id }, data: { isActive } });

const remove = id => prisma.visualizerScene.deleteMany({ where: { id } });

// Everything the browser needs for one scene, with the name in the visitor's language.
const publicSpec = (scene, locale = 'fa') => ({
    id: scene.id,
    name: (locale === 'en' && scene.nameEn) || (locale === 'ar' && scene.nameAr) || scene.name,
    image: scene.image,
    overlay: scene.overlay || null,
    quad: parseQuad(scene.quad),
    wallWidthCm: scene.wallWidthCm,
    wallHeightCm: scene.wallHeightCm,
    lighting: scene.lighting
});

module.exports = { DEFAULT_QUAD, parseQuad, getActive, getAll, findById, create, update, setActive, remove, publicSpec };
