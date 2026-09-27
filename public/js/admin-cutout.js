/* Tile cut-out maker (admin, product form)
   Builds the visualiser's "one tile, transparent background" PNG straight
   from the product's own photos, so the real glaze colour is kept:
   1. the admin marks the four corners of the tile's front face (the photo
      may be taken at an angle) and the face is rectified by a homography;
   2. the backdrop — around the tile and seen through its openings — is
      keyed out: pixels close to the backdrop colour, in connected regions
      big enough to be holes rather than glints; single clicks can clear
      or restore a region by hand;
   3. the PNG is uploaded (/admin/products/cutout) and listed as a colour;
      the list is posted with the product form as JSON (tileVariants).
   The outline shape is guessed from the result's alpha. */
(function () {
    'use strict';

    var root = document.querySelector('[data-cutout-tool]');
    if (!root) return;

    var $ = function (sel) { return root.querySelector(sel); };
    var csrf = root.getAttribute('data-csrf');
    var field = $('[data-cutout-field]');
    var list = $('[data-cutout-list]');
    var shapeSelect = $('[data-cutout-shape]');
    var shapeMsg = $('[data-cutout-shape-msg]');
    var variants = [];
    try { variants = JSON.parse(root.getAttribute('data-variants') || '[]') || []; } catch (e) { variants = []; }

    var SHAPE_LABELS = { square: 'مربع', rectangle: 'مستطیل', lozenge: 'لوزی', hexagon: 'شش‌ضلعی' };

    /* ------------------------------------------------------------------ */
    /* Colour list                                                          */
    /* ------------------------------------------------------------------ */
    function sync() { field.value = JSON.stringify(variants.map(function (v) { return { label: v.label || '', cutout: v.cutout }; })); }
    function renderList() {
        list.innerHTML = '';
        if (!variants.length) {
            var empty = document.createElement('div');
            empty.className = 'cutout-list__empty';
            empty.textContent = 'هنوز تصویری برای شبیه‌ساز ساخته نشده؛ این محصول در شبیه‌ساز نمایش داده نمی‌شود.';
            list.appendChild(empty);
        }
        variants.forEach(function (v, i) {
            var item = document.createElement('div');
            item.className = 'cutout-list__item' + (i === 0 ? ' is-first' : '');
            var img = document.createElement('img'); img.src = v.cutout; img.alt = '';
            var label = document.createElement('input');
            label.type = 'text'; label.maxLength = 60; label.value = v.label || ''; label.placeholder = 'نام رنگ'; label.className = 'input-field !py-1 !px-2 text-xs';
            label.addEventListener('input', function () { v.label = label.value; sync(); });
            var star = document.createElement('button');
            star.type = 'button'; star.textContent = '★'; star.title = 'رنگ پیش‌فرض'; star.className = 'cutout-list__btn' + (i === 0 ? ' is-on' : '');
            star.addEventListener('click', function () { variants.splice(i, 1); variants.unshift(v); renderList(); });
            var del = document.createElement('button');
            del.type = 'button'; del.textContent = '×'; del.title = 'حذف'; del.className = 'cutout-list__btn cutout-list__btn--del';
            del.addEventListener('click', function () { variants.splice(i, 1); renderList(); });
            item.appendChild(img); item.appendChild(label); item.appendChild(star); item.appendChild(del);
            list.appendChild(item);
        });
        sync();
    }
    renderList();

    function upload(blob) {
        var fd = new FormData();
        fd.append('_csrf', csrf);
        fd.append('tileCutout', new File([blob], 'cutout.png', { type: blob.type || 'image/png' }));
        return fetch('/admin/products/cutout', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'x-csrf-token': csrf } })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
            .then(function (j) { if (!j.ok) throw new Error(j.error || 'upload'); return j.path; });
    }

    var ready = $('[data-cutout-ready]');
    if (ready) ready.addEventListener('change', function () {
        var file = ready.files && ready.files[0];
        ready.value = '';
        if (!file) return;
        if (!/image\/(png|webp)/.test(file.type)) { alert('فقط PNG یا WebP با پس‌زمینهٔ شفاف.'); return; }
        upload(file).then(function (path) {
            variants.push({ label: '', cutout: path });
            renderList();
            var img = new Image();
            img.onload = function () { reportShape(detectShapeFromImage(img)); };
            img.src = URL.createObjectURL(file);
        }).catch(function (err) { console.error(err); alert('آپلود ناموفق بود.'); });
    });

    /* ------------------------------------------------------------------ */
    /* Shape detection from the alpha outline                              */
    /* ------------------------------------------------------------------ */
    function detectShape(alpha, w, h) {
        function cov(x0, y0, x1, y1) {
            var s = 0, n = 0;
            for (var y = Math.floor(y0 * h); y < Math.ceil(y1 * h); y++) for (var x = Math.floor(x0 * w); x < Math.ceil(x1 * w); x++) { s += alpha[y * w + x]; n++; }
            return n ? s / n / 255 : 0;
        }
        var c = [cov(0, 0, 0.06, 0.06), cov(0.94, 0, 1, 0.06), cov(0.94, 0.94, 1, 1), cov(0, 0.94, 0.06, 1)];
        var mids = [cov(0.46, 0, 0.54, 0.07), cov(0.93, 0.46, 1, 0.54), cov(0.46, 0.93, 0.54, 1), cov(0, 0.46, 0.07, 0.54)];
        var aspect = w / h;
        if (c.every(function (v) { return v > 0.6; })) return Math.abs(aspect - 1) < 0.12 ? 'square' : 'rectangle';
        if (c.every(function (v) { return v < 0.3; }) && mids.every(function (v) { return v > 0.45; })) {
            // a pointy-top hexagon has vertical sides; a lozenge narrows towards its side points
            return cov(0.02, 0.36, 0.08, 0.44) > 0.5 && cov(0.92, 0.36, 0.98, 0.44) > 0.5 ? 'hexagon' : 'lozenge';
        }
        return null;
    }
    function detectShapeFromImage(img) {
        var s = 96, c = document.createElement('canvas');
        var w = img.naturalWidth >= img.naturalHeight ? s : Math.max(8, Math.round(s * img.naturalWidth / img.naturalHeight));
        var h = img.naturalHeight > img.naturalWidth ? s : Math.max(8, Math.round(s * img.naturalHeight / img.naturalWidth));
        c.width = w; c.height = h;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
        var d = x.getImageData(0, 0, w, h).data, a = new Uint8ClampedArray(w * h);
        for (var i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
        return detectShape(a, w, h);
    }
    function reportShape(shape) {
        if (!shape) return;
        if (shapeSelect && !shapeSelect.value) {
            if (shapeMsg) shapeMsg.textContent = 'تشخیص خودکار از تصویر کاشی: ' + SHAPE_LABELS[shape] + ' (در صورت نیاز از لیست تغییر دهید).';
        }
    }

    /* ------------------------------------------------------------------ */
    /* Maker                                                               */
    /* ------------------------------------------------------------------ */
    var maker = $('[data-cutout-maker]');
    var stage = $('[data-cutout-stage]');
    var img = $('[data-cutout-img]');
    var svg = $('[data-cutout-svg]');
    var loupe = $('[data-cutout-loupe]');
    var preview = $('[data-cutout-preview]');
    var repeat = $('[data-cutout-repeat]');
    var statusEl = $('[data-cutout-status]');
    var inputs = {
        w: $('[data-cutout-w]'), h: $('[data-cutout-h]'), key: $('[data-cutout-key]'), tol: $('[data-cutout-tol]'),
        min: $('[data-cutout-min]'), inset: $('[data-cutout-inset]'), label: $('[data-cutout-label]')
    };
    var bgSwatch = $('[data-cutout-bg]');
    var NS = 'http://www.w3.org/2000/svg';

    var corners = [[0.28, 0.18], [0.72, 0.18], [0.72, 0.82], [0.28, 0.82]];
    var source = null;     // { data: ImageData, w, h }
    var bg = [240, 228, 210];
    var seeds = [];        // { x, y (output fractions), type: 'clear' | 'restore' }
    var tool = null;       // 'pick' | 'clear' | 'restore'
    var last = null;       // { canvas, base } of the latest full-size result

    function setStatus(text, bad) { statusEl.textContent = text || ''; statusEl.classList.toggle('text-red-600', Boolean(bad)); }

    // Sources: saved product images plus files picked in this form but not yet saved.
    function sourceList() {
        var saved = [];
        try { saved = JSON.parse(root.getAttribute('data-sources') || '[]'); } catch (e) { saved = []; }
        var picked = [];
        ['#mainImage', '#galleryImages'].forEach(function (sel) {
            var inp = document.querySelector(sel);
            if (inp && inp.files) Array.prototype.forEach.call(inp.files, function (f) {
                if (!/^image\//.test(f.type)) return;
                f._url = f._url || URL.createObjectURL(f);
                picked.push(f._url);
            });
        });
        return picked.concat(saved);
    }
    function renderSources() {
        var wrap = $('[data-cutout-sources]');
        wrap.innerHTML = '';
        var urls = sourceList();
        if (!urls.length) { wrap.textContent = 'ابتدا تصویر اصلی یا گالری محصول را انتخاب کنید.'; return urls; }
        urls.forEach(function (url) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'cutout-maker__source' + (img.getAttribute('src') === url ? ' is-on' : '');
            var t = document.createElement('img'); t.src = url; t.alt = '';
            b.appendChild(t);
            b.addEventListener('click', function () { loadSource(url); });
            wrap.appendChild(b);
        });
        return urls;
    }
    ['#mainImage', '#galleryImages'].forEach(function (sel) {
        var inp = document.querySelector(sel);
        if (inp) inp.addEventListener('change', function () { if (!maker.hidden) renderSources(); });
    });

    function readImage(url) {
        return new Promise(function (resolve, reject) {
            var im = new Image();
            im.onload = function () { resolve(im); };
            im.onerror = reject;
            im.src = url;
        });
    }
    function toSource(im) {
        var s = Math.min(1, 2000 / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        var x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
        return { data: x.getImageData(0, 0, c.width, c.height), w: c.width, h: c.height };
    }
    // The studio backdrop: median of the outer 3% of the photo.
    function borderColour(src) {
        var d = src.data.data, r = [], g = [], b = [];
        var bw = Math.max(2, Math.round(src.w * 0.03)), bh = Math.max(2, Math.round(src.h * 0.03));
        for (var y = 0; y < src.h; y += 3) for (var x = 0; x < src.w; x += 3) {
            if (x > bw && x < src.w - bw && y > bh && y < src.h - bh) continue;
            var i = (y * src.w + x) * 4; r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]);
        }
        var med = function (a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1] || 0; };
        return [med(r), med(g), med(b)];
    }
    function showBg() { bgSwatch.style.background = 'rgb(' + bg.join(',') + ')'; }

    function loadSource(url) {
        setStatus('');
        return readImage(url).then(function (im) {
            img.src = url;
            source = toSource(im);
            bg = borderColour(source); showBg();
            svg.setAttribute('viewBox', '0 0 1000 ' + Math.round(1000 * source.h / source.w));
            renderSources();
            drawHandles();
            schedule(true);
        }).catch(function () { setStatus('بارگذاری تصویر ناموفق بود.', true); });
    }

    /* ---------------- corner handles ---------------- */
    function el(name, attrs, parent) {
        var n = document.createElementNS(NS, name);
        Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
        if (parent) parent.appendChild(n);
        return n;
    }
    var outline = el('polygon', { class: 'scene-editor__outline' }, svg);
    var handles = corners.map(function (_, i) {
        var c = el('circle', { class: 'scene-editor__handle', 'data-i': i }, svg);
        var t = el('text', { class: 'scene-editor__label' }, svg);
        t.textContent = ['۱', '۲', '۳', '۴'][i];
        return { c: c, t: t };
    });
    function drawHandles() {
        if (!source) return;
        var H = 1000 * source.h / source.w;
        outline.setAttribute('points', corners.map(function (p) { return p[0] * 1000 + ',' + p[1] * H; }).join(' '));
        handles.forEach(function (h, i) {
            h.c.setAttribute('cx', corners[i][0] * 1000); h.c.setAttribute('cy', corners[i][1] * H); h.c.setAttribute('r', 14);
            h.t.setAttribute('x', corners[i][0] * 1000); h.t.setAttribute('y', corners[i][1] * H); h.t.setAttribute('font-size', 16);
        });
    }
    var dragging = -1;
    function frac(e) {
        var r = svg.getBoundingClientRect();
        return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
    }
    svg.addEventListener('pointerdown', function (e) {
        var t = e.target.closest('[data-i]');
        if (!t) return;
        dragging = parseInt(t.getAttribute('data-i'), 10);
        svg.setPointerCapture(e.pointerId); e.preventDefault();
        magnify(frac(e));
    });
    svg.addEventListener('pointermove', function (e) {
        if (dragging < 0) return;
        corners[dragging] = frac(e);
        drawHandles(); magnify(corners[dragging]); schedule(false);
    });
    function endDrag() { if (dragging < 0) return; dragging = -1; loupe.hidden = true; schedule(true); }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    var lctx = loupe.getContext('2d');
    function magnify(p) {
        if (!img.naturalWidth) return;
        var size = loupe.width, zoom = 3, r = svg.getBoundingClientRect();
        var half = size / 2 / zoom * (img.naturalWidth / r.width);
        lctx.clearRect(0, 0, size, size);
        lctx.drawImage(img, p[0] * img.naturalWidth - half, p[1] * img.naturalHeight - half, half * 2, half * 2, 0, 0, size, size);
        lctx.strokeStyle = 'rgba(225,29,72,0.9)'; lctx.lineWidth = 1.5;
        lctx.beginPath(); lctx.moveTo(size / 2, 0); lctx.lineTo(size / 2, size); lctx.moveTo(0, size / 2); lctx.lineTo(size, size / 2); lctx.stroke();
        loupe.classList.toggle('is-right', p[0] < 0.35 && p[1] < 0.45);
        loupe.hidden = false;
    }

    /* ---------------- rectify + key ---------------- */
    function squareToQuad(q) {
        var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
        var sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
        var dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
        var den = dx1 * dy2 - dx2 * dy1, g = 0, h = 0;
        if (Math.abs(den) > 1e-12) { g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den; }
        return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
    }
    function adjugate(m) {
        return [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
            m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
            m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
    }
    function colourDist(r, g, b, c) {
        var dr = r - c[0], dg = g - c[1], db = b - c[2];
        return Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
    }

    // Returns { canvas, base } — base is the rectified RGBA before keying.
    function build(src, maxSide) {
        var tw = Math.max(1, parseFloat(inputs.w.value) || 20), th = Math.max(1, parseFloat(inputs.h.value) || 20);
        var W = tw >= th ? maxSide : Math.round(maxSide * tw / th), H = tw >= th ? Math.round(maxSide * th / tw) : maxSide;
        var lozenge = shapeSelect && shapeSelect.value === 'lozenge';
        var target = lozenge ? [[W / 2, 0], [W, H / 2], [W / 2, H], [0, H / 2]] : [[0, 0], [W, 0], [W, H], [0, H]];
        var toUnit = adjugate(squareToQuad(target));
        var toSrc = squareToQuad(corners.map(function (p) { return [p[0] * src.w, p[1] * src.h]; }));
        var inset = (parseFloat(inputs.inset.value) || 0) / 100;
        var sd = src.data.data, sw = src.w, sh = src.h;
        var out = new ImageData(W, H), od = out.data;
        var shape = new Uint8Array(W * H);
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var px = x + 0.5, py = y + 0.5;
            var uz = toUnit[6] * px + toUnit[7] * py + toUnit[8];
            var u = (toUnit[0] * px + toUnit[1] * py + toUnit[2]) / uz, v = (toUnit[3] * px + toUnit[4] * py + toUnit[5]) / uz;
            var o = (y * W + x) * 4;
            if (u < -0.002 || u > 1.002 || v < -0.002 || v > 1.002) continue; // outside a lozenge
            shape[y * W + x] = 1;
            u = inset + u * (1 - 2 * inset); v = inset + v * (1 - 2 * inset);
            var sz = toSrc[6] * u + toSrc[7] * v + toSrc[8];
            var sx = (toSrc[0] * u + toSrc[1] * v + toSrc[2]) / sz - 0.5, sy = (toSrc[3] * u + toSrc[4] * v + toSrc[5]) / sz - 0.5;
            var x0 = Math.max(0, Math.min(sw - 2, Math.floor(sx))), y0 = Math.max(0, Math.min(sh - 2, Math.floor(sy)));
            var fx = Math.max(0, Math.min(1, sx - x0)), fy = Math.max(0, Math.min(1, sy - y0));
            var i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
            for (var k = 0; k < 3; k++) {
                od[o + k] = (sd[i00 + k] * (1 - fx) + sd[i10 + k] * fx) * (1 - fy) + (sd[i01 + k] * (1 - fx) + sd[i11 + k] * fx) * fy;
            }
            od[o + 3] = 255;
        }
        var alpha = keyOut(out, shape, W, H);
        for (var p = 0; p < W * H; p++) od[p * 4 + 3] = alpha[p];
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        c.getContext('2d').putImageData(out, 0, 0);
        return { canvas: c, alpha: alpha, W: W, H: H };
    }

    // 1 = keep. Backdrop-coloured regions large enough to be openings go
    // transparent; then the admin's clicks; then a 3x3 blur softens the edge.
    function keyOut(img, shape, W, H) {
        var d = img.data, n = W * H;
        var keep = new Uint8Array(n);
        for (var i = 0; i < n; i++) keep[i] = shape[i];
        var tol = parseFloat(inputs.tol.value) || 38;
        var queue = new Int32Array(n);
        function flood(start, test, value, seen) {
            seen = seen || new Uint8Array(n);
            var head = 0, tail = 0, members = [];
            queue[tail++] = start; seen[start] = 1;
            while (head < tail) {
                var p = queue[head++]; members.push(p);
                var x = p % W, y = (p / W) | 0;
                var nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
                for (var k = 0; k < 4; k++) { var q = nb[k]; if (q >= 0 && !seen[q] && test(q)) { seen[q] = 1; queue[tail++] = q; } }
            }
            if (value !== undefined) for (var m = 0; m < members.length; m++) keep[members[m]] = value;
            return members;
        }
        if (inputs.key.checked) {
            var cand = new Uint8Array(n);
            for (var j = 0; j < n; j++) if (shape[j] && colourDist(d[j * 4], d[j * 4 + 1], d[j * 4 + 2], bg) < tol) cand[j] = 1;
            var minArea = (parseFloat(inputs.min.value) || 0) / 100 * n;
            var done = new Uint8Array(n);
            var isCand = function (q) { return cand[q] === 1; };
            for (var s = 0; s < n; s++) {
                if (!cand[s] || done[s]) continue;
                var region = flood(s, isCand, undefined, done);
                if (region.length >= Math.max(4, minArea)) for (var r2 = 0; r2 < region.length; r2++) keep[region[r2]] = 0;
            }
        }
        seeds.forEach(function (sd) {
            var p = Math.min(H - 1, Math.floor(sd.y * H)) * W + Math.min(W - 1, Math.floor(sd.x * W));
            if (!shape[p]) return;
            if (sd.type === 'clear') {
                var ref = [d[p * 4], d[p * 4 + 1], d[p * 4 + 2]];
                flood(p, function (q) { return shape[q] && colourDist(d[q * 4], d[q * 4 + 1], d[q * 4 + 2], ref) < tol; }, 0);
            } else if (!keep[p]) {
                flood(p, function (q) { return shape[q] && !keep[q]; }, 1);
            }
        });
        var alpha = new Uint8ClampedArray(n);
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var sum = 0, cnt = 0;
            for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
                var xx = x + dx, yy = y + dy;
                if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
                sum += keep[yy * W + xx]; cnt++;
            }
            alpha[y * W + x] = shape[y * W + x] ? Math.round(255 * sum / cnt) : 0;
        }
        return alpha;
    }

    var pending = null, pendingFull = false;
    function schedule(full) {
        pendingFull = pendingFull || full;
        if (pending) return;
        pending = requestAnimationFrame(function () {
            pending = null;
            var f = pendingFull; pendingFull = false;
            if (!source) return;
            var res = build(source, f ? 640 : 280);
            if (f) last = res;
            show(res);
        });
    }
    function show(res) {
        preview.width = res.W; preview.height = res.H;
        preview.getContext('2d').drawImage(res.canvas, 0, 0);
        // 3×3 repeat on a shaded wall, as the site will show it
        var t = 96, g = 3;
        repeat.width = t * 3 + g * 4; repeat.height = Math.round(t * res.H / res.W) * 3 + g * 4;
        var th = Math.round(t * res.H / res.W), rc = repeat.getContext('2d');
        rc.fillStyle = '#8f877c'; rc.fillRect(0, 0, repeat.width, repeat.height);
        for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) rc.drawImage(res.canvas, g + c * (t + g), g + r * (th + g), t, th);
        reportShape(detectShape(res.alpha, res.W, res.H));
    }

    // Clicks on the preview: pick the backdrop colour, or clear/restore a region.
    preview.addEventListener('click', function (e) {
        if (!tool || !last) return;
        var r = preview.getBoundingClientRect();
        var fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
        if (tool === 'pick') {
            var picked = sampleRectified(fx, fy);
            if (picked) { bg = picked; showBg(); }
            setTool(null);
        } else {
            seeds.push({ x: fx, y: fy, type: tool });
        }
        schedule(true);
    });
    // Colour of the rectified face at an output fraction (straight from the photo).
    function sampleRectified(fx, fy) {
        if (!source) return null;
        var inset = (parseFloat(inputs.inset.value) || 0) / 100;
        var u = inset + fx * (1 - 2 * inset), v = inset + fy * (1 - 2 * inset);
        if (shapeSelect && shapeSelect.value === 'lozenge') {
            var ux = fx - 0.5, uy = fy - 0.5; // diamond -> unit square (rotate 45°)
            u = inset + (ux + uy + 0.5) * (1 - 2 * inset); v = inset + (uy - ux + 0.5) * (1 - 2 * inset);
        }
        var m = squareToQuad(corners.map(function (p) { return [p[0] * source.w, p[1] * source.h]; }));
        var z = m[6] * u + m[7] * v + m[8];
        var x = Math.round((m[0] * u + m[1] * v + m[2]) / z), y = Math.round((m[3] * u + m[4] * v + m[5]) / z);
        if (x < 0 || y < 0 || x >= source.w || y >= source.h) return null;
        var i = (y * source.w + x) * 4, d = source.data.data;
        return [d[i], d[i + 1], d[i + 2]];
    }

    function setTool(next) {
        tool = tool === next ? null : next;
        root.querySelectorAll('[data-cutout-tool]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-cutout-tool') === tool); });
        preview.classList.toggle('is-picking', Boolean(tool));
    }
    root.querySelectorAll('[data-cutout-tool]').forEach(function (b) {
        b.addEventListener('click', function () { setTool(b.getAttribute('data-cutout-tool')); });
    });
    $('[data-cutout-seeds-reset]').addEventListener('click', function () { seeds = []; schedule(true); });
    ['w', 'h', 'tol', 'min', 'inset'].forEach(function (k) { inputs[k].addEventListener('input', function () { schedule(true); }); });
    inputs.key.addEventListener('change', function () { schedule(true); });
    if (shapeSelect) shapeSelect.addEventListener('change', function () { schedule(true); });

    function toBlob(canvas) {
        return new Promise(function (resolve, reject) { canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('toBlob')); }, 'image/png'); });
    }

    $('[data-cutout-add]').addEventListener('click', function () {
        if (!source) { setStatus('اول یک تصویر انتخاب کنید.', true); return; }
        var btn = this; btn.disabled = true; setStatus('در حال ذخیره…');
        var res = build(source, 640);
        toBlob(res.canvas).then(upload).then(function (path) {
            variants.push({ label: inputs.label.value.trim(), cutout: path });
            inputs.label.value = '';
            renderList();
            setStatus('اضافه شد. برای ثبت نهایی، محصول را ذخیره کنید.');
        }).catch(function (err) { console.error(err); setStatus('ذخیره ناموفق بود.', true); })
            .then(function () { btn.disabled = false; });
    });

    // Same corners and settings for every photo: the catalogue shots of one
    // design are taken from the same angle, one per colour.
    $('[data-cutout-all]').addEventListener('click', function () {
        var urls = sourceList();
        if (!urls.length) return;
        if (!confirm('برای ' + urls.length + ' تصویر، با همین گوشه‌ها و تنظیمات، تصویر کاشی ساخته شود؟ بعد از ساخت نام رنگ‌ها را وارد کنید و موارد نامناسب را حذف کنید.')) return;
        var btn = this; btn.disabled = true;
        var chain = Promise.resolve(), done = 0;
        urls.forEach(function (url) {
            chain = chain.then(function () { return readImage(url); }).then(function (im) {
                var res = build(toSource(im), 640);
                return toBlob(res.canvas).then(upload);
            }).then(function (path) {
                variants.push({ label: '', cutout: path });
                done++; setStatus(done + ' از ' + urls.length + ' ساخته شد…');
                renderList();
            }).catch(function (err) { console.error(err); });
        });
        chain.then(function () {
            btn.disabled = false;
            setStatus(done + ' تصویر اضافه شد. نام رنگ‌ها را وارد و محصول را ذخیره کنید.');
        });
    });

    $('[data-cutout-open]').addEventListener('click', function () {
        maker.hidden = false;
        var urls = renderSources();
        if (urls.length && !source) loadSource(urls[0]);
        maker.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('[data-cutout-close]').addEventListener('click', function () { maker.hidden = true; setTool(null); });
})();
