// One source of truth for the visualiser: which shapes exist, their default
// physical size (cm) and how a shape is guessed from a product's name/slug when
// the admin has not set it explicitly.
const SHAPES = {
    square:    { label: 'مربع',        labelEn: 'Square',      width: 20, height: 20 },
    rectangle: { label: 'مستطیل',      labelEn: 'Rectangle',   width: 30, height: 10 },
    lozenge:   { label: 'لوزی',        labelEn: 'Lozenge',     width: 20, height: 30 },
    hexagon:   { label: 'شش‌ضلعی',     labelEn: 'Hexagon',     width: 20, height: 23 },
    scale:     { label: 'پولکی',       labelEn: 'Fish scale',  width: 15, height: 17 },
    arabesque: { label: 'اسلیمی',      labelEn: 'Arabesque',   width: 20, height: 26 }
};

const HINTS = [
    ['lozenge', 'rhomb', 'diamond', 'لوزی'],
    ['hexagon', 'hex', 'شش', 'زنبور'],
    ['scale', 'fish', 'scallop', 'پولک', 'فلس'],
    ['arabesque', 'اسلیمی', 'لانتری', 'lantern'],
    ['subway', 'rectangle', 'brick', 'مستطیل', 'آجر']
];
const HINT_SHAPE = ['lozenge', 'hexagon', 'scale', 'arabesque', 'rectangle'];

const inferShape = (...texts) => {
    const haystack = texts.filter(Boolean).map(t => String(t).toLowerCase()).join(' ');
    for (let i = 0; i < HINTS.length; i++) {
        if (HINTS[i].some(h => haystack.includes(h))) return HINT_SHAPE[i];
    }
    return 'square';
};

const isShape = value => Object.prototype.hasOwnProperty.call(SHAPES, value);

// "20x30", "20×30 سانتی‌متر", "۲۰*۳۰" -> { width: 20, height: 30 }
const parseDimensions = value => {
    if (!value) return null;
    const latin = String(value).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const m = latin.match(/(\d+(?:[.,]\d+)?)\s*[x×*٭]\s*(\d+(?:[.,]\d+)?)/i);
    if (!m) return null;
    const w = parseFloat(m[1].replace(',', '.'));
    const h = parseFloat(m[2].replace(',', '.'));
    return w > 0 && h > 0 ? { width: w, height: h } : null;
};

// Everything the browser needs to lay a product on a wall.
const visualizerSpec = product => {
    const shape = isShape(product.tileShape) ? product.tileShape : inferShape(product.slug, product.name, product.patternName);
    const parsed = parseDimensions(product.dimensions);
    const width = product.tileWidthCm || (parsed && parsed.width) || SHAPES[shape].width;
    // Height is only a fallback for a missing PNG; the browser takes the real
    // proportions from the cut-out itself.
    const height = product.tileHeightCm || (parsed && parsed.height) || SHAPES[shape].height;
    return {
        slug: product.slug,
        name: product.patternName || product.name,
        color: product.color || '',
        category: product.category || '',
        shape,
        width,
        height,
        image: product.mainImage || null,
        // Transparent PNG of one whole tile: its alpha channel is the outline,
        // so the browser only has to place copies on the shape's lattice.
        cutout: product.tileCutout || null
    };
};

// Only products with a cut-out can be laid on a wall.
const hasCutout = product => Boolean(product && product.tileCutout);

module.exports = { SHAPES, inferShape, isShape, parseDimensions, visualizerSpec, hasCutout };
