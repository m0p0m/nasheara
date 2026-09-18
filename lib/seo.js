const clip = (text, max = 158) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return clean.slice(0, max - 1).replace(/[\s،,.;:]+\S*$/, '') + '…';
};

const siteUrlFrom = req => (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

const absolute = (siteUrl, path) => (!path ? undefined : path.startsWith('http') ? path : `${siteUrl}${path}`);

// Persian/Arabic pages should show local digits in titles and descriptions.
const localizeDigits = (text, locale) => {
    if (locale === 'en') return text;
    const digits = locale === 'ar' ? '٠١٢٣٤٥٦٧٨٩' : '۰۱۲۳۴۵۶۷۸۹';
    return String(text).replace(/\d/g, d => digits[d]);
};

const breadcrumbList = (siteUrl, items) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: absolute(siteUrl, item.path)
    }))
});

const productListItem = (siteUrl, locale, products) => ({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: products.length,
    itemListElement: products.map((p, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${siteUrl}/${locale}/product/${encodeURIComponent(p.slug)}`,
        name: p.patternName || p.name,
        image: absolute(siteUrl, p.mainImage)
    }))
});

const productSchema = (siteUrl, locale, product, brandName) => {
    const url = `${siteUrl}/${locale}/product/${encodeURIComponent(product.slug)}`;
    const images = [product.mainImage, ...(product.galleryImages || [])].filter(Boolean).map(i => absolute(siteUrl, i));
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': `${url}#product`,
        name: product.patternName || product.name,
        alternateName: product.patternName && product.patternName !== product.name ? product.name : undefined,
        sku: product.slug,
        image: images.length ? images : undefined,
        description: product.metaDescription || product.description || undefined,
        category: product.category || undefined,
        material: product.material || undefined,
        color: product.color || undefined,
        brand: { '@type': 'Brand', name: brandName },
        manufacturer: { '@type': 'Organization', name: brandName },
        url
    };
    if (product.dimensions) {
        schema.additionalProperty = [{ '@type': 'PropertyValue', name: 'dimensions', value: product.dimensions }];
    }
    return schema;
};

module.exports = { clip, siteUrlFrom, absolute, localizeDigits, breadcrumbList, productListItem, productSchema };
