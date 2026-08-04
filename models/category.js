const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataPath = path.join(__dirname, '..', 'data', 'categories.json');

// Read all categories from the file
const getAll = async () => {
    try {
        const data = await fs.readFile(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If the file doesn't exist or is empty, return an empty array
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

// Save all categories to the file
const saveAll = async (categories) => {
    await fs.writeFile(dataPath, JSON.stringify(categories, null, 2));
};

// Get a single category by ID
const findById = async (id) => {
    const categories = await getAll();
    return categories.find(c => c.id === id);
};

// Create a new category
const create = async (categoryData) => {
    const categories = await getAll();
    const newCategory = { id: uuidv4(), ...categoryData };
    categories.push(newCategory);
    await saveAll(categories);
    return newCategory;
};

// Update an existing category
const update = async (id, updatedData) => {
    const categories = await getAll();
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) {
        return null; // Or throw an error
    }
    const updatedCategory = { ...categories[index], ...updatedData };
    categories[index] = updatedCategory;
    await saveAll(categories);
    return updatedCategory;
};

// Delete a category
const remove = async (id) => {
    const categories = await getAll();
    const filteredCategories = categories.filter(c => c.id !== id);
    if (filteredCategories.length === categories.length) {
        return null; // Or throw an error if not found
    }
    await saveAll(filteredCategories);
};

module.exports = {
    getAll,
    findById,
    create,
    update,
    remove,
};
