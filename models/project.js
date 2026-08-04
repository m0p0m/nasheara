const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { slugify } = require('./product');

const dataPath = path.join(__dirname, '..', 'data', 'projects.json');

const getAll = async () => {
    try {
        return JSON.parse(await fs.readFile(dataPath, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

const saveAll = async projects => fs.writeFile(dataPath, JSON.stringify(projects, null, 2));

const uniqueSlug = (value, projects, excludedId = null) => {
    const base = slugify(value);
    const used = new Set(projects.filter(p => p.id !== excludedId).map(p => p.slug));
    if (!used.has(base)) return base;
    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
};

const findById = async id => (await getAll()).find(project => project.id === id);

const findBySlug = async slug => {
    const normalizedSlug = slugify(slug);
    return (await getAll()).find(project => project.slug === normalizedSlug);
};

const create = async projectData => {
    const projects = await getAll();
    const project = {
        id: uuidv4(),
        ...projectData,
        slug: uniqueSlug(projectData.slug || projectData.title, projects),
        galleryImages: Array.isArray(projectData.galleryImages) ? projectData.galleryImages : [],
        relatedProductIds: Array.isArray(projectData.relatedProductIds) ? projectData.relatedProductIds : [],
        createdAt: projectData.createdAt || new Date().toISOString()
    };
    projects.push(project);
    await saveAll(projects);
    return project;
};

const update = async (id, updatedData) => {
    const projects = await getAll();
    const index = projects.findIndex(project => project.id === id);
    if (index === -1) return null;
    const current = projects[index];
    const slugSource = Object.prototype.hasOwnProperty.call(updatedData, 'slug')
        ? (updatedData.slug || updatedData.title || current.title)
        : current.slug;
    projects[index] = { ...current, ...updatedData, slug: uniqueSlug(slugSource, projects, id) };
    await saveAll(projects);
    return projects[index];
};

const remove = async id => {
    const projects = await getAll();
    const remaining = projects.filter(project => project.id !== id);
    if (remaining.length === projects.length) return null;
    await saveAll(remaining);
    return true;
};

module.exports = { getAll, findById, findBySlug, create, update, remove };
