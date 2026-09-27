const Scene = require('../models/visualizerScene');
const { deleteUploadFileSafe, isSafeUploadPath } = require('../middleware/upload');

const fileOf = (req, field) => req.files && req.files[field] && req.files[field][0];

// Overlays sit on top of the tiles, so they must carry transparency.
const overlayUpload = async req => {
    const file = fileOf(req, 'sceneOverlay');
    if (!file) return null;
    if (/image\/(png|webp)/.test(file.mimetype || '')) return '/uploads/' + file.filename;
    await deleteUploadFileSafe('/uploads/' + file.filename);
    return null;
};

const removeFile = async value => { if (value && isSafeUploadPath(value)) await deleteUploadFileSafe(value); };

const redirectError = (res, message, to = '/admin/scenes') => res.redirect(`${to}?error=${encodeURIComponent(message)}`);

exports.list = async (req, res) => {
    try {
        const scenes = await Scene.getAll();
        res.render('admin/scenes/index', {
            title: 'صحنه‌های شبیه‌ساز',
            scenes,
            error: req.query.error || null,
            currentPage: 'scenes',
            layout: 'admin/layout'
        });
    } catch (error) {
        console.error('Error listing scenes:', error);
        res.status(500).send('Server Error');
    }
};

exports.create = async (req, res) => {
    const image = fileOf(req, 'sceneImage');
    if (!String(req.body.name || '').trim()) {
        if (image) await removeFile('/uploads/' + image.filename);
        return redirectError(res, 'نام صحنه الزامی است.');
    }
    if (!image) return redirectError(res, 'عکس صحنه الزامی است.');
    try {
        const overlay = await overlayUpload(req);
        const scene = await Scene.create({ ...req.body, isActive: 'on' }, '/uploads/' + image.filename);
        if (overlay) await Scene.update(scene.id, scene, scene, { overlay });
        // Corners are placed on the edit page, where the photo is visible.
        res.redirect(`/admin/scenes/edit/${scene.id}`);
    } catch (err) {
        console.error('Error creating scene:', err);
        res.status(500).send('Server Error');
    }
};

exports.showEdit = async (req, res) => {
    try {
        const scene = await Scene.findById(req.params.id);
        if (!scene) return res.status(404).send('صحنه یافت نشد.');
        res.render('admin/scenes/edit', {
            title: 'ویرایش صحنه',
            scene: { ...scene, quad: Scene.parseQuad(scene.quad), polygon: Scene.parsePolygon(scene.polygon) },
            error: req.query.error || null,
            saved: req.query.saved === '1',
            currentPage: 'scenes',
            layout: 'admin/layout'
        });
    } catch (error) {
        console.error('Error loading scene:', error);
        res.status(500).send('Server Error');
    }
};

exports.update = async (req, res) => {
    try {
        const scene = await Scene.findById(req.params.id);
        if (!scene) return res.status(404).send('صحنه یافت نشد.');
        if (!String(req.body.name || '').trim()) return redirectError(res, 'نام صحنه الزامی است.', `/admin/scenes/edit/${scene.id}`);

        const files = {};
        const image = fileOf(req, 'sceneImage');
        if (image) { await removeFile(scene.image); files.image = '/uploads/' + image.filename; }
        const overlay = await overlayUpload(req);
        if (overlay) { await removeFile(scene.overlay); files.overlay = overlay; }
        else if (req.body.removeOverlay === 'on') { await removeFile(scene.overlay); files.overlay = null; }

        await Scene.update(scene.id, req.body, scene, files);
        res.redirect(`/admin/scenes/edit/${scene.id}?saved=1`);
    } catch (err) {
        console.error('Error updating scene:', err);
        res.status(500).send('Server Error');
    }
};

exports.toggle = async (req, res) => {
    try {
        const scene = await Scene.findById(req.params.id);
        if (scene) await Scene.setActive(scene.id, !scene.isActive);
        res.redirect('/admin/scenes');
    } catch (err) {
        console.error('Error toggling scene:', err);
        res.status(500).send('Server Error');
    }
};

exports.remove = async (req, res) => {
    try {
        const scene = await Scene.findById(req.params.id);
        if (scene) {
            await removeFile(scene.image);
            await removeFile(scene.overlay);
            await Scene.remove(scene.id);
        }
        res.redirect('/admin/scenes');
    } catch (err) {
        console.error('Error deleting scene:', err);
        res.status(500).send('Server Error');
    }
};
