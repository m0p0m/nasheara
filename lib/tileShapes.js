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

// A tile is laid ON a wall; a breeze block BUILDS the wall (partition, screen,
// facade) and light passes through its openings. They never share a scene.
const KINDS = {
    tile:  { label: 'کاشی (روی دیوار)',          labelEn: 'Tile' },
    block: { label: 'بلوک (دیوار / پارتیشن مشبک)', labelEn: 'Breeze block' }
};
const isKind = value => Object.prototype.hasOwnProperty.call(KINDS, value);
const BLOCK_HINTS = ['بلوک', 'بلوك', 'block', 'breeze', 'مشبک', 'claustra'];
const inferKind = (...texts) => {
    const haystack = texts.filter(Boolean).map(t => String(t).toLowerCase()).join(' ');
    return BLOCK_HINTS.some(h => haystack.includes(h)) ? 'block' : 'tile';
};

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

// Colour variants of one design: [{ label, cutout }] with a usable cut-out path.
// A product with only the older single `tileCutout` gets one unnamed variant.
const parseVariants = (value, fallbackCutout = null) => {
    let list = value;
    if (typeof list === 'string') { try { list = JSON.parse(list); } catch (e) { list = null; } }
    const clean = (Array.isArray(list) ? list : [])
        .filter(v => v && typeof v.cutout === 'string' && v.cutout.startsWith('/uploads/') && !v.cutout.includes('..'))
        .map(v => ({ label: String(v.label || '').trim().slice(0, 60), cutout: v.cutout }));
    if (!clean.length && fallbackCutout) clean.push({ label: '', cutout: fallbackCutout });
    return clean;
};

// Everything the browser needs to lay a product on a wall.
const visualizerSpec = product => {
    const kind = isKind(product.tileKind) ? product.tileKind : inferKind(product.slug, product.name, product.patternName, product.category);
    const explicit = isShape(product.tileShape);
    const shape = explicit ? product.tileShape : inferShape(product.slug, product.name, product.patternName);
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
        kind,
        shape,
        // false = guessed from the name; the browser may correct it from the PNG outline
        shapeExplicit: explicit,
        width,
        height,
        image: product.mainImage || null,
        // Transparent PNG of one whole tile: its alpha channel is the outline,
        // so the browser only has to place copies on the shape's lattice.
        cutout: product.tileCutout || null,
        variants: parseVariants(product.tileVariants, product.tileCutout || null)
    };
};

// Only products with a cut-out can be laid on a wall.
const hasCutout = product => Boolean(product && (product.tileCutout || parseVariants(product.tileVariants).length));

module.exports = { SHAPES, KINDS, inferShape, isShape, inferKind, isKind, parseDimensions, parseVariants, visualizerSpec, hasCutout };
