const Product = require('../models/product');
const Category = require('../models/category');
const Article = require('../models/article');
const Project = require('../models/project');
const seo = require('../lib/seo');
const Testimonial = require('../models/testimonial');
const { visualizerSpec, SHAPES, hasCutout, colourName } = require('../lib/tileShapes');
const Scene = require('../models/visualizerScene');
const { imageUrl } = require('../lib/images');
const videoLib = require('../lib/video');

// Questions shown by views/public/_buy-guide.ejs, also sent as FAQPage JSON-LD.
const faqItems = t => [1, 2, 3, 4, 5].map(i => ({ q: t(`guide.faq${i}q`), a: t(`guide.faq${i}a`) }));

const categoryPath = category => `/category/${encodeURIComponent(category.slug)}`;

// Display the home page with limited products (8-10)
const getHomePage = async (req, res) => {
    try {
        const query = (req.query.q || '').trim();
        const allProducts = await Product.getAll(req.locale);
        // A category without its own cover falls back to any product image in it,
        // not just one of the 8 products shown on the home page.
        const categories = (await Category.getAll(req.locale)).map(cat => {
            if (cat.mainImage) return cat;
            const rep = allProducts.find(p => p.category === cat.name && p.mainImage);
            return rep ? { ...cat, mainImage: rep.mainImage } : cat;
        });
        const filtered = query
            ? allProducts.filter(p =>
                [p.name, p.description, p.category]
                    .filter(Boolean)
                    .some(v => String(v).toLowerCase().includes(query.toLowerCase()))
              )
            : allProducts;
const products = filtered.slice(0, 8); // Show only 8 products on home page
        const articles = await Article.getPublished(6, req.locale); // Get 6 latest published articles
        const projects = (await Project.getAll(req.locale))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 3);
        const testimonials = await Testimonial.getPublished(6);
        res.render('public/home', {
            testimonials,
            title: res.locals.t('seo.homeTitle'),
            metaDescription: res.locals.t('seo.homeDesc'),
            products: products,
            categories,
            articles: articles,
            projects,
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
        const allProducts = await Product.getAll(req.locale);
        const categories = await Category.getAll(req.locale);
        // Old filter URLs (?category=name) now live at /category/:slug.
        if (selectedCategory && !query) {
            const match = categories.find(c => [c.name, c.translations && c.translations.fa && c.translations.fa.name, c.slug]
                .filter(Boolean).some(n => n.toLowerCase() === selectedCategory.toLowerCase()));
            if (match) return res.redirect(301, `/${req.locale}${categoryPath(match)}`);
        }

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
        const t = res.locals.t;
        const siteUrl = seo.siteUrlFrom(req);
        res.render('public/products', {
            title: selectedCategory ? t('seo.productsCategoryTitle', { category: selectedCategory }) : t('seo.productsTitle'),
            metaDescription: selectedCategory ? t('seo.productsCategoryDesc', { category: selectedCategory }) : t('seo.productsDesc'),
            noindex: Boolean(query),
            structuredData: [
                seo.breadcrumbList(siteUrl, [
                    { name: t('seo.home'), path: `/${req.locale}/` },
                    { name: t('nav.products'), path: `/${req.locale}/products` }
                ]),
                seo.productListItem(siteUrl, req.locale, products.slice(0, 50)),
                seo.faqSchema(faqItems(t))
            ],
            products,
            categories,
            q: query,
            selectedCategory,
            category: null,
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری صفحه محصولات رخ داد.');
    }
};

// Category landing page: /:locale/category/:slug
const getCategoryPage = async (req, res, next) => {
    try {
        const category = await Category.findBySlug(req.params.slug, req.locale);
        if (!category) return next();
        const [allProducts, categories] = await Promise.all([Product.getAll(req.locale), Category.getAll(req.locale)]);
        const products = allProducts.filter(p => p.categorySlug === category.slug);
        const t = res.locals.t;
        const siteUrl = seo.siteUrlFrom(req);
        const path = categoryPath(category);
        const heading = /دست‌ساز|دست ساز|handmade|يدوي/i.test(category.name)
            ? category.name
            : t('seo.categoryHeading', { category: category.name });
        const indexing = seo.localeIndexing(siteUrl, path, category, 'name', req.locale);
        res.render('public/products', {
            title: t('seo.productsCategoryTitle', { category: category.name }),
            metaDescription: seo.clip(category.description || t('seo.productsCategoryDesc', { category: category.name })),
            canonicalUrl: `${siteUrl}/${req.locale}${path}`,
            ...indexing,
            // an empty category is a thin page; it is also left out of the sitemap
            noindex: indexing.noindex || !products.length,
            ogImage: seo.absolute(siteUrl, category.mainImage || (products[0] && products[0].mainImage)),
            structuredData: [
                seo.breadcrumbList(siteUrl, [
                    { name: t('seo.home'), path: `/${req.locale}/` },
                    { name: t('nav.products'), path: `/${req.locale}/products` },
                    { name: category.name, path: `/${req.locale}${path}` }
                ]),
                seo.productListItem(siteUrl, req.locale, products.slice(0, 50)),
                seo.faqSchema(faqItems(t))
            ],
            products,
            categories,
            q: '',
            selectedCategory: category.name,
            category: { ...category, heading },
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
        const product = await Product.findBySlug(req.params.slug, req.locale);
        if (!product) {
            return res.status(404).render('public/product-detail', {
                title: res.locals.t('seo.notFoundTitle'),
                noindex: true,
                product: null,
                relatedProducts: [],
                layout: 'public/layout',
                currentPath: req.path
            });
        }
        const [allProducts, allProjects] = await Promise.all([Product.getAll(req.locale), Project.getAll(req.locale)]);
        // Projects this design was installed in: real-world proof and internal links.
        const usedInProjects = allProjects.filter(p => (p.relatedProductIds || []).includes(product.id)).slice(0, 6);
        const relatedProducts = allProducts
            .filter(p => p.id !== product.id && p.category && product.category && p.category === product.category)
            .slice(0, 4);
        const siteUrl = seo.siteUrlFrom(req);
        const t = res.locals.t;
        const displayName = product.patternName || product.name;
        const productPath = `/product/${encodeURIComponent(product.slug)}`;
        const brand = t('atelier.brandName');
        const withBrand = text => (text.includes(brand) || text.length + brand.length > 62 ? text : `${text} | ${brand}`);
        // English reads values mid-sentence, so they lose their Title Case; fa/ar list with the Arabic comma.
        const inText = value => (req.locale === 'en' ? String(value).toLowerCase() : value);
        const usage = Array.isArray(product.usageArea) && product.usageArea.length
            ? product.usageArea.map(inText).join(req.locale === 'en' ? ', ' : '، ')
            : '';
        const translated = seo.translatedLocales(product, 'name').includes(req.locale);
        const generatedDescription = translated && product.material && product.color && usage
            ? t('seo.productDesc', { name: displayName, material: inText(product.material), color: inText(product.color), usage })
            : t('seo.productDescShort', { name: displayName });
        // A hand-written description in this language beats the generated one.
        const ownDescription = product.translations && product.translations[req.locale] && product.translations[req.locale].metaDescription;
        res.render('public/product-detail', {
            title: (req.locale === 'fa' && product.metaTitle && withBrand(product.metaTitle))
                || (product.category && product.categoryTranslated
                    ? t('seo.productTitle', { name: product.name, category: product.category })
                    : t('seo.productTitleNoCategory', { name: product.name })),
            metaDescription: seo.clip(
                ownDescription
                    ? (ownDescription.length < 90 ? `${ownDescription.replace(/[.。]$/, '')}. ${t('seo.productDescShort', { name: displayName }).replace(`${displayName}؛ `, '')}` : ownDescription)
                    : generatedDescription
            ),
            metaKeywords: Array.isArray(product.keywords) ? product.keywords.join(', ') : product.keywords,
            canonicalUrl: `${siteUrl}/${req.locale}${productPath}`,
            ...seo.localeIndexing(siteUrl, productPath, product, 'name', req.locale),
            ogImage: seo.absolute(siteUrl, product.mainImage),
            ogType: 'product',
            siteUrl,
            structuredData: [
                seo.productSchema(siteUrl, req.locale, product, t('atelier.brandName')),
                seo.breadcrumbList(siteUrl, [
                    { name: t('seo.home'), path: `/${req.locale}/` },
                    { name: t('nav.products'), path: `/${req.locale}/products` },
                    ...(product.categorySlug ? [{ name: product.category, path: `/${req.locale}${categoryPath({ slug: product.categorySlug })}` }] : []),
                    { name: product.name, path: `/${req.locale}${productPath}` }
                ]),
                seo.faqSchema(faqItems(t)),
                ...videoLib.schemas(siteUrl, product.video, {
                    name: product.name,
                    description: product.metaDescription || seo.clip(product.description || ''),
                    image: product.mainImage,
                    url: `${siteUrl}/${req.locale}${productPath}`,
                    updatedAt: product.updatedAt
                })
            ],
            product: product,
            relatedProducts,
            usedInProjects,
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
        const projects = (await Project.getAll(req.locale))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.render('public/projects', {
            title: res.locals.t('seo.projectsTitle'),
            metaDescription: res.locals.t('seo.projectsDesc'),
            projects, layout: 'public/layout', currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری نمونه‌کارها رخ داد.');
    }
};

// Display a completed project and its related products
const getProjectDetail = async (req, res) => {
    try {
        const project = await Project.findBySlug(req.params.slug, req.locale);
        if (!project) {
            return res.status(404).render('public/project-detail', {
                title: res.locals.t('seo.notFoundTitle'), noindex: true, project: null, relatedProducts: [],
                layout: 'public/layout', currentPath: req.path
            });
        }
        const products = await Product.getAll(req.locale);
        const references = project.relatedProductIds || [];
        const relatedProducts = references
            .map(reference => products.find(product => product.id === reference || product.slug === reference))
            .filter((product, index, list) => product && list.findIndex(item => item.id === product.id) === index);
        const siteUrl = seo.siteUrlFrom(req);
        const t = res.locals.t;
        res.render('public/project-detail', {
            title: project.location && !project.title.includes(project.location)
                ? t('seo.projectTitleWithLocation', { title: project.title, location: project.location })
                : t('seo.projectTitle', { title: project.title }),
            metaDescription: seo.clip(project.description || t('seo.projectDesc', { title: project.title, location: project.location ? ` — ${project.location}` : '' })),
            canonicalUrl: `${siteUrl}/${req.locale}/project/${encodeURIComponent(project.slug)}`,
            ...seo.localeIndexing(siteUrl, `/project/${encodeURIComponent(project.slug)}`, project, 'title', req.locale),
            ogImage: seo.absolute(siteUrl, project.coverImage || (project.galleryImages && project.galleryImages[0])),
            ogType: 'article',
            siteUrl,
            structuredData: [
                seo.breadcrumbList(siteUrl, [
                    { name: t('seo.home'), path: `/${req.locale}/` },
                    { name: t('nav.projects'), path: `/${req.locale}/projects` },
                    { name: project.title, path: `/${req.locale}/project/${encodeURIComponent(project.slug)}` }
                ]),
                ...videoLib.schemas(siteUrl, project.video, {
                    name: project.title,
                    description: seo.clip(project.description || project.title),
                    image: project.coverImage || (project.galleryImages && project.galleryImages[0]),
                    url: `${siteUrl}/${req.locale}/project/${encodeURIComponent(project.slug)}`,
                    updatedAt: project.createdAt
                })
            ],
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

// Sitemaps for search engines: /sitemap.xml is an index pointing to one
// sitemap per section (/sitemaps/products.xml, …). Google reads each section
// separately and Search Console reports indexing per section.
const SITEMAP_SECTIONS = ['pages', 'categories', 'products', 'projects', 'articles', 'cities'];

const buildSitemapSections = async baseUrl => {
    const [products, projects, articles, categories] = await Promise.all([
        Product.getAll(), Project.getAll(), Article.getPublished(), Category.getAll()
    ]);
    const isoDate = value => {
        const d = value ? new Date(value) : null;
        // Full W3C datetime: Google trusts <lastmod> only while it matches real
        // edits, and a date alone hides a second change on the same day.
        return d && !Number.isNaN(d.getTime()) ? d.toISOString().replace(/\.\d{3}Z$/, '+00:00') : undefined;
    };
    const newest = list => {
        const stamp = list.reduce((max, item) => Math.max(max, new Date(item.updatedAt || item.createdAt || 0).getTime()), 0);
        return stamp ? isoDate(stamp) : undefined;
    };
    const images = list => list.filter(Boolean).map(i => seo.absolute(baseUrl, i));
    return {
        pages: [
            { path: '/', lastmod: newest([...products, ...projects, ...articles]) },
            { path: '/products', lastmod: newest(products) },
            { path: '/projects', lastmod: newest(projects) },
            { path: '/articles', lastmod: newest(articles) },
            { path: '/visualizer' },
            { path: '/contact' },
            { path: '/consultation' }
        ],
        categories: categories.map(category => {
            const own = products.filter(p => p.categorySlug === category.slug);
            return own.length ? {
                path: categoryPath(category), lastmod: newest(own),
                locales: seo.translatedLocales(category, 'name'),
                images: images([category.mainImage])
            } : null;
        }).filter(Boolean),
        products: products.map(product => ({
            path: `/product/${encodeURIComponent(product.slug)}`,
            lastmod: isoDate(product.updatedAt || product.createdAt),
            locales: seo.translatedLocales(product, 'name'),
            images: images([product.mainImage, ...(product.galleryImages || [])]),
            videos: videoLib.sitemapVideos(baseUrl, product.video, {
                name: product.name, description: product.metaDescription || seo.clip(product.description || product.name),
                image: product.mainImage, updatedAt: product.updatedAt
            })
        })),
        projects: projects.map(project => ({
            path: `/project/${encodeURIComponent(project.slug)}`,
            lastmod: isoDate(project.updatedAt || project.createdAt),
            locales: seo.translatedLocales(project, 'title'),
            images: images([project.coverImage, ...(project.galleryImages || [])]),
            videos: videoLib.sitemapVideos(baseUrl, project.video, {
                name: project.title, description: seo.clip(project.description || project.title),
                image: project.coverImage, updatedAt: project.createdAt
            })
        })),
        articles: articles.map(article => ({
            path: `/article/${encodeURIComponent(article.slug)}`,
            lastmod: isoDate(article.updatedAt || article.createdAt),
            locales: seo.translatedLocales(article, 'title'),
            images: images([article.mainImage])
        })),
        // city pages are Persian only
        cities: [
            { path: '/cities', locales: ['fa'], lastmod: require('../lib/cities').UPDATED },
            ...require('../lib/cities').CITIES.map(city => ({
                path: `/city/${encodeURIComponent(city.slug)}`, locales: ['fa'], lastmod: city.updated || require('../lib/cities').UPDATED
            }))
        ]
    };
};

const sitemapLastmod = entries => entries.map(e => e.lastmod).filter(Boolean).sort().pop();

const renderUrlset = (baseUrl, entries) => {
    const locales = ['fa', 'en', 'ar'];
    const localePath = (locale, path) => `${baseUrl}/${locale}${path === '/' ? '/' : path}`;
    // Only list a page in the languages it is actually written in.
    const localesOf = entry => entry.locales || locales;
    const urlNode = (locale, entry) => [
        '  <url>',
        `    <loc>${xmlEscape(localePath(locale, entry.path))}</loc>`,
        entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
        ...localesOf(entry).map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${xmlEscape(localePath(l, entry.path))}"/>`),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(localePath('fa', entry.path))}"/>`,
        ...[...new Set(entry.images || [])].map(loc => `    <image:image><image:loc>${xmlEscape(loc)}</image:loc></image:image>`),
        ...(entry.videos || []).map(v => [
            '    <video:video>',
            `      <video:thumbnail_loc>${xmlEscape(v.thumbnail)}</video:thumbnail_loc>`,
            `      <video:title>${xmlEscape(v.title)}</video:title>`,
            `      <video:description>${xmlEscape(String(v.description).slice(0, 2000))}</video:description>`,
            v.content ? `      <video:content_loc>${xmlEscape(v.content)}</video:content_loc>` : null,
            v.player ? `      <video:player_loc>${xmlEscape(v.player)}</video:player_loc>` : null,
            v.date ? `      <video:publication_date>${xmlEscape(v.date)}</video:publication_date>` : null,
            '    </video:video>'
        ].filter(Boolean).join('\n')),
        '  </url>'
    ].filter(Boolean).join('\n');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n' +
        locales.flatMap(locale => entries.filter(entry => localesOf(entry).includes(locale)).map(entry => urlNode(locale, entry))).join('\n') +
        '\n</urlset>';
};

// GET /sitemap.xml — sitemap index
const getSitemap = async (req, res) => {
    try {
        const baseUrl = seo.siteUrlFrom(req);
        const sections = await buildSitemapSections(baseUrl);
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            SITEMAP_SECTIONS.filter(name => sections[name].length).map(name => {
                const lastmod = sitemapLastmod(sections[name]);
                return `  <sitemap>\n    <loc>${xmlEscape(`${baseUrl}/sitemaps/${name}.xml`)}</loc>\n` +
                    (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') + '  </sitemap>';
            }).join('\n') +
            '\n</sitemapindex>';
        res.set('Cache-Control', 'public, max-age=3600');
        res.type('application/xml').send(xml);
    } catch (error) {
        console.error('Failed to generate sitemap:', error);
        res.status(500).send('Cannot generate sitemap');
    }
};

// GET /sitemaps/:file — one section, e.g. /sitemaps/products.xml
const getSitemapSection = async (req, res, next) => {
    const name = String(req.params.file || '').replace(/\.xml$/, '');
    if (!SITEMAP_SECTIONS.includes(name) || !/\.xml$/.test(req.params.file)) return next();
    try {
        const baseUrl = seo.siteUrlFrom(req);
        const sections = await buildSitemapSections(baseUrl);
        res.set('Cache-Control', 'public, max-age=3600');
        res.type('application/xml').send(renderUrlset(baseUrl, sections[name]));
    } catch (error) {
        console.error('Failed to generate sitemap section:', error);
        res.status(500).send('Cannot generate sitemap');
    }
};

const getRobots = (req, res) => {
    const baseUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    res.type('text/plain').send(
        `User-agent: *\nAllow: /\nDisallow: /admin\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
};

// Display contact page
const getContactPage = async (req, res) => {
    try {
        res.render('public/contact', {
            title: res.locals.t('seo.contactTitle'),
            metaDescription: res.locals.t('seo.contactDesc'),
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری صفحه تماس با ما رخ داد.');
    }
};

const getVisualizerPage = async (req, res) => {
    try {
        const [products, scenes] = await Promise.all([Product.getAll(req.locale), Scene.getActive()]);
        // The engine samples cut-outs at ~512px and photos at 2048px, so ship those sizes.
        const tiles = products.filter(hasCutout).map(visualizerSpec).map(tile => ({
            ...tile,
            thumb: imageUrl(tile.variants[0].cutout, 160),
            cutout: imageUrl(tile.variants[0].cutout, 1024),
            variants: tile.variants.map(v => ({ label: colourName(v.label, req.locale), thumb: imageUrl(v.cutout, 160), cutout: imageUrl(v.cutout, 1024) }))
        }));
        const requested = String(req.query.product || '').trim();
        const initial = tiles.find(tile => tile.slug === requested) || tiles[0] || null;
        res.render('public/visualizer', {
            title: res.locals.t('seo.visualizerTitle'),
            metaDescription: res.locals.t('seo.visualizerDesc'),
            layout: 'public/layout',
            currentPath: req.path,
            tiles,
            scenes: scenes.map(scene => Scene.publicSpec(scene, req.locale)).map(scene => ({
                ...scene, thumb: imageUrl(scene.image, 320), image: imageUrl(scene.image, 2048), overlay: scene.overlay ? imageUrl(scene.overlay, 2048) : null
            })),
            initialSlug: initial ? initial.slug : null,
            initialScene: String(req.query.scene || ''),
            shapes: SHAPES
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری صفحه شبیه‌ساز رخ داد.');
    }
};

module.exports = {
    getHomePage,
    getVisualizerPage,
    getAllProducts,
    getCategoryPage,
    getProductDetail,
    getAllProjects,
    getProjectDetail,
    getSitemap,
    getSitemapSection,
    getRobots,
    getContactPage
};
