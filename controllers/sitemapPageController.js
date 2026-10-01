// GET /:locale/sitemap — every public page grouped by type, for people (the
// XML sitemap at /sitemap.xml is for search engines). Also gives every page
// an internal link from one place.
const Product = require('../models/product');
const Category = require('../models/category');
const Project = require('../models/project');
const Article = require('../models/article');
const seo = require('../lib/seo');
const { CITIES } = require('../lib/cities');

const LABELS = {
    fa: { title: 'نقشهٔ سایت', desc: 'فهرست همهٔ صفحه‌های سایت نقش آرا: دسته‌بندی‌ها، کاشی‌ها و بلوک‌ها، نمونه‌کارها، مقاله‌ها و شهرها.', main: 'صفحه‌های اصلی', categories: 'دسته‌بندی‌ها', products: 'کاشی‌ها و بلوک‌ها', projects: 'نمونه‌کارها', articles: 'مقاله‌ها', cities: 'شهرها', citiesLink: 'ارسال به شهرها' },
    en: { title: 'Site map', desc: 'All pages of the Naghsh Ara website: categories, tiles and blocks, projects and articles.', main: 'Main pages', categories: 'Categories', products: 'Tiles and blocks', projects: 'Projects', articles: 'Articles' },
    ar: { title: 'خريطة الموقع', desc: 'جميع صفحات موقع نقش آرا: الفئات والبلاط والبلوكات والمشاريع والمقالات.', main: 'الصفحات الرئيسية', categories: 'الفئات', products: 'البلاط والبلوكات', projects: 'المشاريع', articles: 'المقالات' }
};

const getSitemapPage = async (req, res) => {
    try {
        const locale = req.locale;
        const t = res.locals.t;
        const L = LABELS[locale] || LABELS.fa;
        const [products, categories, projects, articles] = await Promise.all([
            Product.getAll(locale), Category.getAll(locale), Project.getAll(locale), Article.getPublished(null, locale)
        ]);
        const enc = encodeURIComponent;
        const groups = [
            { title: L.main, links: [
                [t('seo.home'), '/'], [t('nav.products'), '/products'], [t('nav.projects'), '/projects'],
                [t('nav.articles'), '/articles'], [t('nav.visualizer'), '/visualizer'], [t('nav.contact'), '/contact'],
                [t('atelier.requestConsultation'), '/consultation'],
                ...(locale === 'fa' ? [[L.citiesLink, '/cities']] : [])
            ] },
            { title: L.categories, links: categories.map(c => [c.name, `/category/${enc(c.slug)}`]) },
            { title: L.products, links: products.map(p => [p.name, `/product/${enc(p.slug)}`]) },
            { title: L.projects, links: projects.map(p => [p.title, `/project/${enc(p.slug)}`]) },
            { title: L.articles, links: articles.map(a => [a.title, `/article/${enc(a.slug)}`]) },
            ...(locale === 'fa' ? [{ title: L.cities, links: CITIES.map(c => [`کاشی دست‌ساز در ${c.name}`, `/city/${enc(c.slug)}`]) }] : [])
        ].filter(g => g.links.length);
        const siteUrl = seo.siteUrlFrom(req);
        res.render('public/sitemap-page', {
            title: `${L.title} | ${t('atelier.brandName')}`,
            metaDescription: L.desc,
            canonicalUrl: `${siteUrl}/${locale}/sitemap`,
            heading: L.title,
            groups,
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error');
    }
};

module.exports = { getSitemapPage };
