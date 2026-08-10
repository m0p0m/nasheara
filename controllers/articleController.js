const Article = require('../models/article');
const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

// Generate slug from title
const generateSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
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
            if (article.mainImage) {
                const oldImagePath = path.join(__dirname, '..', 'public', article.mainImage);
                try {
                    await fs.unlink(oldImagePath);
                } catch (err) {
                    console.error('Error deleting old image:', err);
                }
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
        if (article && article.mainImage) {
            const imagePath = path.join(__dirname, '..', 'public', article.mainImage);
            try {
                await fs.unlink(imagePath);
            } catch (err) {
                console.error('Error deleting image:', err);
            }
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
                title: 'مقاله یافت نشد',
                article: null,
                layout: 'public/layout',
                currentPath: req.path
            });
        }
        const articleHtml = marked.parse(article.content || '');
        const siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
        res.render('public/article-detail', {
            title: article.metaTitle || article.title,
            metaDescription: article.metaDescription,
            metaKeywords: article.metaKeywords,
            canonicalUrl: `${siteUrl}/${req.locale}/article/${encodeURIComponent(article.slug)}`,
            ogImage: article.mainImage ? `${siteUrl}${article.mainImage}` : undefined,
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
            title: 'مقالات - شرکت تصفیه آب صبا',
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
    getArticleDetail,
    getAllArticles
};

