const Product = require('../models/product');
const Category = require('../models/category');
const Article = require('../models/article');
const Project = require('../models/project');

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

// Display all completed projects
const getAllProjects = async (req, res) => {
    try {
        const projects = (await Project.getAll())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.render('public/projects', {
            title: 'نمونه‌کارها', projects, layout: 'public/layout', currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری نمونه‌کارها رخ داد.');
    }
};

// Display a completed project and its related products
const getProjectDetail = async (req, res) => {
    try {
        const project = await Project.findBySlug(req.params.slug);
        if (!project) {
            return res.status(404).render('public/project-detail', {
                title: 'نمونه‌کار یافت نشد', project: null, relatedProducts: [],
                layout: 'public/layout', currentPath: req.path
            });
        }
        const products = await Product.getAll();
        const references = project.relatedProductIds || [];
        const relatedProducts = references
            .map(reference => products.find(product => product.id === reference || product.slug === reference))
            .filter((product, index, list) => product && list.findIndex(item => item.id === product.id) === index);
        res.render('public/project-detail', {
            title: project.title,
            metaDescription: project.description ? project.description.substring(0, 160) : undefined,
            ogImage: project.coverImage,
            project, relatedProducts, layout: 'public/layout', currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری نمونه‌کار رخ داد.');
    }
};

const xmlEscape = value => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const getSitemap = async (req, res) => {
    try {
        const baseUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
        const [products, projects, articles] = await Promise.all([
            Product.getAll(), Project.getAll(), Article.getAll()
        ]);
        const paths = [
            '/', '/products', '/projects', '/articles', '/about', '/contact',
            ...products.map(product => `/product/${encodeURIComponent(product.slug)}`),
            ...projects.map(project => `/project/${encodeURIComponent(project.slug)}`),
            ...articles.map(article => `/article/${encodeURIComponent(article.slug)}`)
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            paths.map(urlPath => `  <url><loc>${xmlEscape(`${baseUrl}${urlPath}`)}</loc></url>`).join('\n') +
            '\n</urlset>';
        res.type('application/xml').send(xml);
    } catch (error) {
        console.error('Failed to generate sitemap:', error);
        res.status(500).send('Cannot generate sitemap');
    }
};

const getRobots = (req, res) => {
    const baseUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    res.type('text/plain').send(
        `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
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
    getAllProjects,
    getProjectDetail,
    getSitemap,
    getRobots,
    getAboutPage,
    getContactPage
};
