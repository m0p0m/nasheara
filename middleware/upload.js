const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_ROOT = path.resolve(__dirname, '..', 'public', 'uploads');

const normalizeUploadPath = value => {
    if (!value || typeof value !== 'string') return '';
    const normalized = value.replace(/\\/g, '/').trim();
    return normalized.replace(/^\/+(?:uploads\/)?/, '').replace(/^uploads\//, '');
};

const isSafeUploadPath = imagePath => {
    if (!imagePath || typeof imagePath !== 'string') return false;
    const normalized = imagePath.replace(/\\/g, '/').trim();
    if (!normalized || normalized.includes('\0')) return false;
    if (normalized.includes('..')) return false;

    const relativePath = normalizeUploadPath(normalized);
    if (!relativePath || relativePath.startsWith('/') || relativePath.includes('..')) return false;

    const target = path.resolve(UPLOAD_ROOT, relativePath);
    const relative = path.relative(UPLOAD_ROOT, target);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const deleteUploadFileSafe = async imagePath => {
    if (!imagePath || !isSafeUploadPath(imagePath)) return false;
    const relativePath = normalizeUploadPath(imagePath);
    const diskPath = path.resolve(UPLOAD_ROOT, relativePath);
    try {
        await fs.promises.unlink(diskPath);
        return true;
    } catch (error) {
        if (error && error.code !== 'ENOENT') {
            console.error('Upload file delete failed:', error.message);
        }
        return false;
    }
};

// Set up storage engine
const storage = multer.diskStorage({
    destination: UPLOAD_ROOT,
    filename: function(req, file, cb){
        const ext = path.extname(file.originalname || '').toLowerCase();
        const safeName = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, safeName);
    }
});

function checkFileType(file, cb){
    // Short muted loops for the video section (see lib/video.js).
    if (file.fieldname === 'videoClip') {
        const ok = /\.(mp4|webm)$/i.test(file.originalname || '') && /^video\/(mp4|webm)$/.test(file.mimetype || '');
        return ok ? cb(null, true) : cb(new Error('Error: MP4 or WebM video only!'));
    }
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extname = allowed.test(path.extname(file.originalname || '').toLowerCase());
    const mimetype = /image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype || '');
    if (extname && mimetype) return cb(null, true);
    return cb(new Error('Error: Images Only!'));
}

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 12,
        // The product form alone posts ~35 fields (three languages, specs, SEO)
        // plus dynamic spec rows; keep a ceiling but leave real headroom.
        parts: 250,
        fields: 240,
        fieldSize: 200 * 1024
    },
    fileFilter: function(req, file, cb){
        checkFileType(file, cb);
    }
}).fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
    { name: 'tileCutout', maxCount: 1 },
    { name: 'sceneImage', maxCount: 1 },
    { name: 'sceneOverlay', maxCount: 1 },
    { name: 'galleryImages', maxCount: 5 },
    { name: 'videoClip', maxCount: 1 },
    { name: 'videoPoster', maxCount: 1 }
]);

module.exports = upload;
module.exports.isSafeUploadPath = isSafeUploadPath;
module.exports.deleteUploadFileSafe = deleteUploadFileSafe;
module.exports.UPLOAD_ROOT = UPLOAD_ROOT;
