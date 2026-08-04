const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataPath = path.join(__dirname, '..', 'data', 'products.json');

// Turn Persian or English text into a URL-friendly slug while preserving letters.
const slugify = (value) => {
    const slug = String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/ي/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[\s\u200c_]+/g, '-')
        .replace(/[^\p{L}\p{N}-]+/gu, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return slug || 'product';
};

const createUniqueSlug = (value, products, excludedId = null) => {
    const baseSlug = slugify(value);
    const usedSlugs = new Set(
        products
            .filter(product => product.id !== excludedId && product.slug)
            .map(product => slugify(product.slug))
    );

    if (!usedSlugs.has(baseSlug)) return baseSlug;

    let suffix = 2;
    while (usedSlugs.has(`${baseSlug}-${suffix}`)) suffix += 1;
    return `${baseSlug}-${suffix}`;
};

// Read all products from the file
const getAll = async () => {
    try {
        const data = await fs.readFile(dataPath, 'utf8');
        const products = JSON.parse(data);
        let slugsChanged = false;
        const productsWithSlugs = [];
        for (const product of products) {
            const slug = createUniqueSlug(product.slug || product.name, productsWithSlugs);
            if (product.slug !== slug) slugsChanged = true;
            productsWithSlugs.push({ ...product, slug });
        }

        // Transparently migrate products created before slugs were introduced.
        if (slugsChanged) await saveAll(productsWithSlugs);
        return productsWithSlugs;
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

// Save all products to the file
const saveAll = async (products) => {
    await fs.writeFile(dataPath, JSON.stringify(products, null, 2));
};

// Get a single product by ID
const findById = async (id) => {
    const products = await getAll();
    return products.find(p => p.id === id);
};

// Get a single product by its public URL slug
const findBySlug = async (slug) => {
    const products = await getAll();
    const normalizedSlug = slugify(slug);
    return products.find(product => product.slug === normalizedSlug);
};

// Create a new product
const create = async (productData) => {
    const products = await getAll();
    const slug = createUniqueSlug(productData.slug || productData.name, products);
    const newProduct = { id: uuidv4(), ...productData, slug };
    products.push(newProduct);
    await saveAll(products);
    return newProduct;
};

// Update an existing product
const update = async (id, updatedData) => {
    let products = await getAll();
    const index = products.findIndex(p => p.id === id);
    if (index === -1) {
        return null;
    }
    const existingProduct = products[index];
    const hasSlugUpdate = Object.prototype.hasOwnProperty.call(updatedData, 'slug');
    const slugSource = hasSlugUpdate
        ? (updatedData.slug || updatedData.name || existingProduct.name)
        : (existingProduct.slug || updatedData.name || existingProduct.name);
    const slug = createUniqueSlug(slugSource, products, id);
    products[index] = { ...existingProduct, ...updatedData, slug };
    await saveAll(products);
    return products[index];
};

// Delete a product
const remove = async (id) => {
    const products = await getAll();
    const filteredProducts = products.filter(p => p.id !== id);
    if (filteredProducts.length === products.length) {
        return null;
    }
    await saveAll(filteredProducts);
};

module.exports = {
    getAll,
    findById,
    findBySlug,
    create,
    update,
    remove,
    slugify,
};
