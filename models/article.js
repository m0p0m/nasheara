const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataPath = path.join(__dirname, '..', 'data', 'articles.json');

// Read all articles from the file
const getAll = async () => {
    try {
        const data = await fs.readFile(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

// Save all articles to the file
const saveAll = async (articles) => {
    await fs.writeFile(dataPath, JSON.stringify(articles, null, 2));
};

// Get a single article by ID
const findById = async (id) => {
    const articles = await getAll();
    return articles.find(a => a.id === id);
};

// Get articles by slug
const findBySlug = async (slug) => {
    const articles = await getAll();
    return articles.find(a => a.slug === slug);
};

// Create a new article
const create = async (articleData) => {
    const articles = await getAll();
    const newArticle = { 
        id: uuidv4(), 
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...articleData 
    };
    articles.push(newArticle);
    await saveAll(articles);
    return newArticle;
};

// Update an existing article
const update = async (id, updatedData) => {
    let articles = await getAll();
    const index = articles.findIndex(a => a.id === id);
    if (index === -1) {
        return null;
    }
    articles[index] = { 
        ...articles[index], 
        ...updatedData,
        updatedAt: new Date().toISOString()
    };
    await saveAll(articles);
    return articles[index];
};

// Delete an article
const remove = async (id) => {
    const articles = await getAll();
    const filteredArticles = articles.filter(a => a.id !== id);
    if (filteredArticles.length === articles.length) {
        return null;
    }
    await saveAll(filteredArticles);
};

// Get published articles
const getPublished = async (limit = null) => {
    const articles = await getAll();
    const published = articles
        .filter(a => a.published === true)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return limit ? published.slice(0, limit) : published;
};

module.exports = {
    getAll,
    findById,
    findBySlug,
    create,
    update,
    remove,
    getPublished
};

