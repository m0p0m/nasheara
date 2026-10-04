const Project = require('../models/project');
const Product = require('../models/product');
const upload = require('../middleware/upload');
const { deleteUploadFileSafe, isSafeUploadPath } = upload;
const fs = require('fs').promises;
const path = require('path');
const { Prisma } = require('@prisma/client');
const videoLib = require('../lib/video');

const normalizeArray = value => {
    if (!value) return [];
    const values = Array.isArray(value) ? value : String(value).split(/[,،\r\n]+/);
    return [...new Set(values.map(item => String(item).trim()).filter(Boolean))];
};

const removeImage = async imagePath => {
    if (!imagePath || !isSafeUploadPath(imagePath)) return;
    await deleteUploadFileSafe(imagePath);
};

const listProjects = async (req, res) => {
    try {
        const projects = await Project.getAll();
        res.render('admin/projects/index', {
            title: 'مدیریت نمونه‌کارها', projects, currentPage: 'projects', layout: 'admin/layout'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری نمونه‌کارها رخ داد.');
    }
};

const showAddForm = async (req, res) => {
    try {
        const products = await Product.getAll();
        res.render('admin/projects/add', {
            title: 'افزودن نمونه‌کار', products, currentPage: 'projects', layout: 'admin/layout'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری فرم رخ داد.');
    }
};

const addProject = async (req, res) => {
    try {
        const { title, slug, location, description, relatedProductIds, translations = {} } = req.body;
        const fa = translations.fa || {};
        await Project.create({
            title: fa.title || title, slug, location: fa.location || location,
            description: fa.description || description, translations,
            coverImage: req.files.coverImage ? `/uploads/${req.files.coverImage[0].filename}` : null,
            galleryImages: req.files.galleryImages
                ? req.files.galleryImages.map(file => `/uploads/${file.filename}`)
                : [],
            relatedProductIds: normalizeArray(relatedProductIds),
            video: videoLib.fromForm(req.body, req.files, null).video || undefined
        });
        res.redirect('/admin/projects');
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در افزودن نمونه‌کار رخ داد.');
    }
};

const showEditForm = async (req, res) => {
    try {
        const [project, products] = await Promise.all([Project.findById(req.params.id), Product.getAll()]);
        if (!project) return res.status(404).send('نمونه‌کار یافت نشد.');
        res.render('admin/projects/edit', {
            title: 'ویرایش نمونه‌کار', project, products, currentPage: 'projects', layout: 'admin/layout'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری نمونه‌کار رخ داد.');
    }
};

const editProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).send('نمونه‌کار یافت نشد.');
        const { title, slug, location, description, relatedProductIds, translations = {} } = req.body;
        const fa = translations.fa || {};
        const updatedData = {
            title: fa.title || title, slug, location: fa.location || location,
            description: fa.description || description, translations,
            relatedProductIds: normalizeArray(relatedProductIds)
        };
        const { video, obsolete } = videoLib.fromForm(req.body, req.files, project.video);
        updatedData.video = video || Prisma.DbNull;
        await Promise.all(obsolete.map(removeImage));
        if (req.files.coverImage) {
            await removeImage(project.coverImage);
            updatedData.coverImage = `/uploads/${req.files.coverImage[0].filename}`;
        }
        // Drop gallery images the admin ticked for removal, then append new uploads
        let gallery = project.galleryImages || [];
        const removed = normalizeArray(req.body.removeGalleryImages).filter(p => gallery.includes(p));
        if (removed.length) {
            gallery = gallery.filter(p => !removed.includes(p));
            await Promise.all(removed.map(removeImage));
            updatedData.galleryImages = gallery;
        }
        if (req.files.galleryImages) {
            const additions = req.files.galleryImages.map(file => `/uploads/${file.filename}`);
            updatedData.galleryImages = gallery.concat(additions);
        }
        await Project.update(req.params.id, updatedData);
        res.redirect('/admin/projects');
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در ویرایش نمونه‌کار رخ داد.');
    }
};

const deleteProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).send('نمونه‌کار یافت نشد.');
        await removeImage(project.coverImage);
        await Promise.all((project.galleryImages || []).map(removeImage));
        const oldVideo = videoLib.normalize(project.video);
        await Promise.all([oldVideo.clip, oldVideo.poster].map(removeImage));
        await Project.remove(req.params.id);
        res.redirect('/admin/projects');
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در حذف نمونه‌کار رخ داد.');
    }
};

module.exports = { listProjects, showAddForm, addProject, showEditForm, editProject, deleteProject };
