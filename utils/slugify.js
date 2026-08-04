const slugify = value => {
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
    return slug || 'item';
};

module.exports = slugify;
