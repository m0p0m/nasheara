const seo = require('../lib/seo');
const Article = require('../models/article');
const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const upload = require('../middleware/upload');
const { deleteUploadFileSafe, isSafeUploadPath } = upload;
const slugify = require('../utils/slugify');

// Generate slug from title
const generateSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const renderArticleMarkdown = content => {
    const usedHeadingIds = new Map();
    const renderer = new marked.Renderer();
    renderer.heading = function ({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const text = tokens.map(token => token.raw || token.text || '').join(' ')
            .replace(/[`*_[\]()]/g, '');
        const baseId = slugify(text) || 'section';
        const count = (usedHeadingIds.get(baseId) || 0) + 1;
        usedHeadingIds.set(baseId, count);
        const id = count === 1 ? baseId : `${baseId}-${count}`;
        return `<h${depth} id="${id}">${html}</h${depth}>\n`;
    };
    renderer.html = () => '';

    const rendered = marked.parse(content || '', { gfm: true, breaks: true, renderer });
    return sanitizeHtml(rendered, {
        allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'figure', 'figcaption', 'h1', 'h2'],
        allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            '*': ['id', 'class'],
            a: ['href', 'name', 'target', 'rel', 'title'],
            img: ['src', 'alt', 'title', 'width', 'height', 'loading']
        },
        allowedSchemes: ['http', 'https', 'mailto', 'tel'],
        transformTags: {
            a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
            img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }, true)
        }
    });
};

const uploadInlineImage = (req, res) => {
    const file = req.files?.mainImage?.[0] || req.files?.galleryImages?.[0];
    if (!file) return res.status(400).json({ error: 'فایل تصویری انتخاب نشده است.' });
    return res.status(201).json({
        url: `/uploads/${file.filename}`,
        alt: path.basename(file.originalname, path.extname(file.originalname)).replace(/[-_]+/g, ' ')
    });
};

// Admin: List all articles
const listArticles = async (req, res) => {
    try {
        const articles = await Article.getAll();
        res.render('admin/articles/index', {
            title: 'مدیریت مقالات',
            articles: articles,
            currentPage: 'articles',
            layout: 'admin/layout'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری مقالات رخ داد.');
    }
};

// Admin: Show add form
const showAddForm = (req, res) => {
    res.render('admin/articles/add', {
        title: 'افزودن مقاله جدید',
        currentPage: 'articles',
        layout: 'admin/layout'
    });
};

// Admin: Add new article
const addArticle = async (req, res) => {
    try {
        const { title, content, excerpt, metaTitle, metaDescription, metaKeywords, published, translations = {} } = req.body;
        const fa = translations.fa || {};
        const primaryTitle = fa.title || title;
        const primaryContent = fa.content || content || '';
        const slug = generateSlug(primaryTitle);
        
        const articleData = {
            title: primaryTitle,
            slug,
            content: primaryContent,
            excerpt: fa.excerpt || excerpt || primaryContent.substring(0, 200),
            metaTitle: fa.metaTitle || metaTitle || primaryTitle,
            metaDescription: fa.metaDescription || metaDescription || fa.excerpt || excerpt || primaryContent.substring(0, 160),
            metaKeywords: fa.metaKeywords || metaKeywords || '',
            translations,
            published: published === 'on' || published === true,
            mainImage: req.files && req.files.mainImage ? `/uploads/${req.files.mainImage[0].filename}` : null
        };

        await Article.create(articleData);
        res.redirect('/admin/articles');
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در افزودن مقاله رخ داد.');
    }
};

// Admin: Show edit form
const showEditForm = async (req, res) => {
    try {
        const article = await Article.findById(req.params.id);
        if (!article) {
            return res.status(404).send('مقاله یافت نشد.');
        }
        res.render('admin/articles/edit', {
            title: 'ویرایش مقاله',
            article: article,
            currentPage: 'articles',
            layout: 'admin/layout'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری مقاله رخ داد.');
    }
};

// Admin: Update article
const updateArticle = async (req, res) => {
    try {
        const { title, content, excerpt, metaTitle, metaDescription, metaKeywords, published, translations = {} } = req.body;
        const fa = translations.fa || {};
        const primaryTitle = fa.title || title;
        const primaryContent = fa.content || content || '';
        const article = await Article.findById(req.params.id);
        
        if (!article) {
            return res.status(404).send('مقاله یافت نشد.');
        }

        const slug = generateSlug(primaryTitle);
        const updatedData = {
            title: primaryTitle,
            slug,
            content: primaryContent,
            excerpt: fa.excerpt || excerpt || primaryContent.substring(0, 200),
            metaTitle: fa.metaTitle || metaTitle || primaryTitle,
            metaDescription: fa.metaDescription || metaDescription || fa.excerpt || excerpt || primaryContent.substring(0, 160),
            metaKeywords: fa.metaKeywords || metaKeywords || '',
            translations,
            published: published === 'on' || published === true
        };

        if (req.files && req.files.mainImage) {
            // Delete old image if exists
            if (article.mainImage && isSafeUploadPath(article.mainImage)) {
                await deleteUploadFileSafe(article.mainImage);
            }
            updatedData.mainImage = `/uploads/${req.files.mainImage[0].filename}`;
        }

        await Article.update(req.params.id, updatedData);
        res.redirect('/admin/articles');
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در به‌روزرسانی مقاله رخ داد.');
    }
};

// Admin: Delete article
const deleteArticle = async (req, res) => {
    try {
        const article = await Article.findById(req.params.id);
        if (article && article.mainImage && isSafeUploadPath(article.mainImage)) {
            await deleteUploadFileSafe(article.mainImage);
        }
        await Article.remove(req.params.id);
        res.redirect('/admin/articles');
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در حذف مقاله رخ داد.');
    }
};

// Public: Get article detail
const getArticleDetail = async (req, res) => {
    try {
        const article = await Article.findBySlug(req.params.slug, req.locale);
        if (!article || !article.published) {
            return res.status(404).render('public/article-detail', {
                title: res.locals.t('seo.notFoundTitle'),
                noindex: true,
                article: null,
                layout: 'public/layout',
                currentPath: req.path
            });
        }
        const articleHtml = renderArticleMarkdown(article.content);
        const siteUrl = seo.siteUrlFrom(req);
        const t = res.locals.t;
        const brand = t('atelier.brandName');
        const articlePath = `/article/${encodeURIComponent(article.slug)}`;
        const articleUrl = `${siteUrl}/${req.locale}${articlePath}`;
        // Without its own description an article fell back to the site-wide one,
        // so every article showed Google the same snippet.
        const plainText = String(article.content || '')
            .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/[#>*_`|-]+/g, ' ');
        const description = seo.describe(article.metaDescription || article.excerpt, plainText);
        const image = seo.absolute(siteUrl, article.mainImage);
        const articleStructuredData = {
            '@context': 'https://schema.org',
            '@type': 'Article',
            '@id': `${articleUrl}#article`,
            headline: article.title,
            description: description || undefined,
            image: image ? [image] : undefined,
            datePublished: article.createdAt,
            dateModified: article.updatedAt || article.createdAt,
            inLanguage: { fa: 'fa-IR', en: 'en', ar: 'ar' }[req.locale],
            mainEntityOfPage: articleUrl,
            author: { '@type': 'Organization', name: brand, url: `${siteUrl}/${req.locale}/` },
            publisher: {
                '@type': 'Organization',
                '@id': `${siteUrl}/#business`,
                name: brand,
                logo: { '@type': 'ImageObject', url: `${siteUrl}/icons/logo-1024.png` }
            }
        };
        const brandedTitle = text => (text.includes(brand) || text.length + brand.length > 62 ? text : `${text} | ${brand}`);
        res.render('public/article-detail', {
            title: brandedTitle(article.metaTitle || article.title),
            metaDescription: description,
            metaKeywords: article.metaKeywords,
            canonicalUrl: articleUrl,
            ...seo.localeIndexing(siteUrl, articlePath, article, 'title', req.locale),
            ogImage: image,
            ogType: 'article',
            structuredData: [
                articleStructuredData,
                seo.breadcrumbList(siteUrl, [
                    { name: t('seo.home'), path: `/${req.locale}/` },
                    { name: t('nav.articles'), path: `/${req.locale}/articles` },
                    { name: article.title, path: `/${req.locale}${articlePath}` }
                ])
            ],
            article: article,
            articleHtml,
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری مقاله رخ داد.');
    }
};

// Public: List all articles
const getAllArticles = async (req, res) => {
    try {
        const articles = await Article.getPublished(null, req.locale);
        res.render('public/articles', {
            title: res.locals.t('seo.articlesTitle'),
            metaDescription: res.locals.t('seo.articlesDesc'),
            articles: articles,
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری مقالات رخ داد.');
    }
};

module.exports = {
    listArticles,
    showAddForm,
    addArticle,
    showEditForm,
    updateArticle,
    deleteArticle,
    uploadInlineImage,
    getArticleDetail,
    getAllArticles
};
