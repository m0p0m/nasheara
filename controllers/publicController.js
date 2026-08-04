const Product = require('../models/product');
const Category = require('../models/category');
const Article = require('../models/article');

// Display the home page with limited products (8-10)
const getHomePage = async (req, res) => {
    try {
        const query = (req.query.q || '').trim();
        const allProducts = await Product.getAll();
        const categories = await Category.getAll();
        const filtered = query
            ? allProducts.filter(p =>
                [p.name, p.description, p.category]
                    .filter(Boolean)
                    .some(v => String(v).toLowerCase().includes(query.toLowerCase()))
              )
            : allProducts;
        const products = filtered.slice(0, 8); // Show only 8 products on home page
        const articles = await Article.getPublished(6); // Get 6 latest published articles
        res.render('public/home', {
            title: 'صفحه اصلی - شرکت تصفیه آب صبا',
            products: products,
            categories,
            articles: articles,
            q: query,
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری صفحه اصلی رخ داد.');
    }
};

// Display all products page
const getAllProducts = async (req, res) => {
    try {
        const query = (req.query.q || '').trim();
        const selectedCategory = (req.query.category || '').trim();
        const allProducts = await Product.getAll();
        const categories = await Category.getAll();

        let products = allProducts;
        if (query) {
            products = products.filter(p =>
                [p.name, p.description, p.category]
                    .filter(Boolean)
                    .some(v => String(v).toLowerCase().includes(query.toLowerCase()))
            );
        }
        if (selectedCategory) {
            products = products.filter(p => (p.category || '').toLowerCase() === selectedCategory.toLowerCase());
        }
        res.render('public/products', {
            title: 'محصولات - شرکت تصفیه آب صبا',
            products,
            categories,
            q: query,
            selectedCategory,
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری صفحه محصولات رخ داد.');
    }
};

// Display product detail page
const getProductDetail = async (req, res) => {
    try {
        const product = await Product.findBySlug(req.params.slug);
        if (!product) {
            return res.status(404).render('public/product-detail', {
                title: 'محصول یافت نشد - شرکت تصفیه آب صبا',
                product: null,
                relatedProducts: [],
                layout: 'public/layout'
            });
        }
        const allProducts = await Product.getAll();
        const relatedProducts = allProducts
            .filter(p => p.id !== product.id && p.category && product.category && p.category === product.category)
            .slice(0, 4);
        res.render('public/product-detail', {
            title: `${product.name} - شرکت تصفیه آب صبا`,
            metaDescription: product.description ? product.description.substring(0, 160) : undefined,
            ogImage: product.mainImage ? `https://sabatasfiyeh.com${product.mainImage}` : undefined,
            product: product,
            relatedProducts,
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری جزئیات محصول رخ داد.');
    }
};

// Display about page
const getAboutPage = async (req, res) => {
    try {
        res.render('public/about', {
            title: 'درباره ما - شرکت تصفیه آب صبا',
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری صفحه درباره ما رخ داد.');
    }
};

// Display contact page
const getContactPage = async (req, res) => {
    try {
        res.render('public/contact', {
            title: 'تماس با ما - شرکت تصفیه آب صبا',
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری صفحه تماس با ما رخ داد.');
    }
};

module.exports = {
    getHomePage,
    getAllProducts,
    getProductDetail,
    getAboutPage,
    getContactPage
};
