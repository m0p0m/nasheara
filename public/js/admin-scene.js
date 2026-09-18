/* Scene editor (admin)
   - Corners: four draggable handles over the photo; a guide grid of real
     20 cm cells is drawn through the same perspective the site uses, so a
     wrong width/height shows up immediately as squashed cells.
   - Auto height: recovers the wall's real aspect ratio from the perspective
     of the four corners (Zhang & He, "Whiteboard scanning").
   - Foreground: paint over the objects standing in front of the wall; on
     save the painted pixels of the photo are exported as the transparent
     overlay PNG and attached to the form's overlay file input. */
(function () {
    'use strict';

    var root = document.querySelector('[data-scene-editor]');
    if (!root) return;

    var NS = 'http://www.w3.org/2000/svg';
    var photo = root.querySelector('[data-scene-photo]');
    var svg = root.querySelector('[data-scene-svg]');
    var maskCanvas = root.querySelector('[data-scene-mask]');
    var input = document.querySelector('[data-scene-quad]');
    var widthInput = document.querySelector('[name="wallWidthCm"]');
    var heightInput = document.querySelector('[name="wallHeightCm"]');
    var form = root.closest('form');
    var DEFAULT = [[0.1, 0.25], [0.9, 0.25], [0.9, 0.7], [0.1, 0.7]];
    var quad = parse(root.getAttribute('data-quad')) || DEFAULT.map(function (p) { return p.slice(); });
    var W = 1000, H = 1000; // viewBox = photo pixels once it has loaded
    var photoReady = false;

    function parse(text) {
        try {
            var q = JSON.parse(text);
            if (Array.isArray(q) && q.length === 4 && q.every(function (p) { return Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]); })) return q.map(function (p) { return [+p[0], +p[1]]; });
        } catch (e) { /* fall through */ }
        return null;
    }
    function num(el, fallback) { var v = parseFloat(el && el.value); return isFinite(v) && v > 0 ? v : fallback; }

    /* ---------------- homography (mirrors the visualiser) ---------------- */
    function squareToQuad(q) {
        var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
        var sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
        var dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
        var den = dx1 * dy2 - dx2 * dy1;
        var g = 0, h = 0;
        if (Math.abs(den) > 1e-9) { g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den; }
        return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
    }
    function project(m, u, v) {
        var w = m[6] * u + m[7] * v + m[8];
        return [(m[0] * u + m[1] * v + m[2]) / w, (m[3] * u + m[4] * v + m[5]) / w];
    }

    /* ---------------- aspect ratio from perspective ---------------- */
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    // Returns { ratio: width/height of the real rectangle, mode }. With two
    // vanishing points the focal length is recovered too ("full"); with one
    // (vertical edges still parallel, the usual kitchen shot) a typical lens
    // is assumed, which stays within a few percent; a frontal photo simply
    // uses the pixel proportions.
    function estimateAspect(q) {
        var u0 = W / 2, v0 = H / 2;
        var px = function (i) { return [q[i][0] * W, q[i][1] * H]; };
        var m1 = [q[0][0] * W - u0, q[0][1] * H - v0, 1], m2 = [q[1][0] * W - u0, q[1][1] * H - v0, 1];
        var m3 = [q[3][0] * W - u0, q[3][1] * H - v0, 1], m4 = [q[2][0] * W - u0, q[2][1] * H - v0, 1];
        var k2 = dot(cross(m1, m4), m3) / dot(cross(m2, m4), m3);
        var k3 = dot(cross(m1, m4), m2) / dot(cross(m3, m4), m2);
        var n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
        var n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
        var flat2 = Math.abs(n2[2]) < 1e-3, flat3 = Math.abs(n3[2]) < 1e-3;
        if (flat2 && flat3) {
            var dist = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
            var wpx = (dist(px(0), px(1)) + dist(px(3), px(2))) / 2, hpx = (dist(px(0), px(3)) + dist(px(1), px(2))) / 2;
            return { ratio: wpx / hpx, mode: 'frontal' };
        }
        var mode = 'full';
        var f2 = flat2 || flat3 ? NaN : -(n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2]);
        if (!isFinite(f2) || f2 <= 0) { f2 = Math.pow(0.85 * Math.max(W, H), 2); mode = 'assumed'; }
        var r2 = ((n2[0] * n2[0] + n2[1] * n2[1]) / f2 + n2[2] * n2[2]) / ((n3[0] * n3[0] + n3[1] * n3[1]) / f2 + n3[2] * n3[2]);
        return isFinite(r2) && r2 > 0 ? { ratio: Math.sqrt(r2), mode: mode } : null;
    }

    /* ---------------- corners ---------------- */
    function el(name, attrs) {
        var node = document.createElementNS(NS, name);
        Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
        return node;
    }
    var grid = el('path', { class: 'scene-editor__grid' });
    var outline = el('polygon', { class: 'scene-editor__outline' });
    var handles = quad.map(function (_, i) {
        var c = el('circle', { class: 'scene-editor__handle', 'data-i': i });
        var label = el('text', { class: 'scene-editor__label', 'data-i': i });
        label.textContent = ['۱', '۲', '۳', '۴'][i];
        return { circle: c, label: label };
    });
    svg.appendChild(grid); svg.appendChild(outline);
    handles.forEach(function (h) { svg.appendChild(h.circle); svg.appendChild(h.label); });

    function render() {
        var s = Math.min(W, H);
        var m = squareToQuad(quad.map(function (p) { return [p[0] * W, p[1] * H]; }));
        var wallW = num(widthInput, 240), wallH = num(heightInput, 60);
        var cols = Math.min(60, Math.max(1, Math.round(wallW / 20))), rows = Math.min(60, Math.max(1, Math.round(wallH / 20)));
        var d = '';
        for (var i = 0; i <= cols; i++) { var a = project(m, i / cols, 0), b = project(m, i / cols, 1); d += 'M' + a[0] + ' ' + a[1] + 'L' + b[0] + ' ' + b[1]; }
        for (var j = 0; j <= rows; j++) { var c = project(m, 0, j / rows), e = project(m, 1, j / rows); d += 'M' + c[0] + ' ' + c[1] + 'L' + e[0] + ' ' + e[1]; }
        grid.setAttribute('d', d);
        outline.setAttribute('points', quad.map(function (p) { return (p[0] * W) + ',' + (p[1] * H); }).join(' '));
        handles.forEach(function (h, i) {
            h.circle.setAttribute('cx', quad[i][0] * W); h.circle.setAttribute('cy', quad[i][1] * H); h.circle.setAttribute('r', s * 0.018);
            h.label.setAttribute('x', quad[i][0] * W); h.label.setAttribute('y', quad[i][1] * H); h.label.setAttribute('font-size', s * 0.022);
        });
        input.value = JSON.stringify(quad.map(function (p) { return [Math.round(p[0] * 10000) / 10000, Math.round(p[1] * 10000) / 10000]; }));
        if (photoReady) syncHeight();
    }

    var dragging = -1;
    function pointToFraction(e) {
        var r = svg.getBoundingClientRect();
        return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
    }
    svg.addEventListener('pointerdown', function (e) {
        var target = e.target.closest('[data-i]');
        if (!target) return;
        dragging = parseInt(target.getAttribute('data-i'), 10);
        svg.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    svg.addEventListener('pointermove', function (e) { if (dragging < 0) return; quad[dragging] = pointToFraction(e); render(); });
    function stopDrag() { dragging = -1; }
    svg.addEventListener('pointerup', stopDrag);
    svg.addEventListener('pointercancel', stopDrag);

    var reset = document.querySelector('[data-scene-reset]');
    if (reset) reset.addEventListener('click', function () { quad = DEFAULT.map(function (p) { return p.slice(); }); render(); });
    if (widthInput) widthInput.addEventListener('input', render);

    // Height follows the corners and the width, exactly as the site computes it.
    var autoMsg = document.querySelector('[data-scene-auto-msg]');
    function syncHeight() {
        var est = estimateAspect(quad);
        if (!est || est.ratio < 0.1 || est.ratio > 30) return;
        heightInput.value = Math.round(num(widthInput, 240) / est.ratio);
        if (autoMsg) autoMsg.textContent = 'نسبت عرض به ارتفاع: ' + est.ratio.toFixed(2) + ' → ارتفاع ≈ ' + heightInput.value + ' سانتی‌متر' + (est.mode === 'assumed' ? ' (تخمین با فرض لنز معمولی)' : '');
    }

    var light = document.querySelector('[data-scene-light]');
    var lightValue = document.querySelector('[data-scene-light-value]');
    if (light && lightValue) light.addEventListener('input', function () { lightValue.textContent = Math.round(parseFloat(light.value) * 100); });

    /* ---------------- foreground mask ---------------- */
    var mctx = maskCanvas ? maskCanvas.getContext('2d') : null;
    var maskDirty = false, maskMode = false, erasing = false, painting = false, last = null;
    var brushInput = document.querySelector('[data-scene-brush]');
    var modeBtns = document.querySelectorAll('[data-scene-mode]');
    var toolBtns = document.querySelectorAll('[data-scene-tool]');
    var overlayInput = document.querySelector('[name="sceneOverlay"]');
    var existingOverlay = root.getAttribute('data-overlay');

    function setMode(mode) {
        maskMode = mode === 'mask';
        root.classList.toggle('is-masking', maskMode);
        modeBtns.forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-scene-mode') === mode); });
        document.querySelectorAll('[data-scene-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-scene-panel') !== mode; });
    }
    modeBtns.forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-scene-mode')); }); });
    toolBtns.forEach(function (b) {
        b.addEventListener('click', function () {
            erasing = b.getAttribute('data-scene-tool') === 'erase';
            toolBtns.forEach(function (o) { o.classList.toggle('is-on', o === b); });
        });
    });

    // Paint an overlay image's alpha into the mask so it can be extended or trimmed.
    function maskFromImage(src) {
        var ov = new Image();
        ov.onload = function () {
            mctx.clearRect(0, 0, W, H);
            mctx.drawImage(ov, 0, 0, W, H);
            mctx.globalCompositeOperation = 'source-in';
            mctx.fillStyle = '#E11D48'; mctx.fillRect(0, 0, W, H);
            mctx.globalCompositeOperation = 'source-over';
        };
        ov.src = src;
    }
    function sizeToPhoto() {
        W = photo.naturalWidth || 1000; H = photo.naturalHeight || 1000;
        photoReady = true;
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        if (maskCanvas) {
            maskCanvas.width = W; maskCanvas.height = H;
            if (existingOverlay) maskFromImage(existingOverlay);
        }
        render();
    }
    if (photo.complete && photo.naturalWidth) sizeToPhoto(); else photo.addEventListener('load', sizeToPhoto);

    // A newly picked photo replaces the one in the editor immediately, so the
    // corners and the foreground mask are set on what will actually be saved.
    var photoInput = document.querySelector('[name="sceneImage"]');
    if (photoInput) photoInput.addEventListener('change', function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file || !/^image\//.test(file.type)) return;
        existingOverlay = null; maskDirty = false; overlayReady = false;
        photo.addEventListener('load', sizeToPhoto, { once: true });
        photo.src = URL.createObjectURL(file);
    });

    function maskPoint(e) {
        var r = maskCanvas.getBoundingClientRect();
        return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
    }
    function stamp(x, y) {
        var radius = (parseFloat(brushInput && brushInput.value) || 3) / 100 * Math.min(W, H) / 2;
        mctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
        var g = mctx.createRadialGradient(x, y, radius * 0.7, x, y, radius);
        g.addColorStop(0, 'rgba(225,29,72,1)'); g.addColorStop(1, 'rgba(225,29,72,0)');
        mctx.fillStyle = g;
        mctx.beginPath(); mctx.arc(x, y, radius, 0, Math.PI * 2); mctx.fill();
    }
    function strokeTo(p) {
        if (!last) { stamp(p[0], p[1]); last = p; return; }
        var dx = p[0] - last[0], dy = p[1] - last[1], dist = Math.sqrt(dx * dx + dy * dy);
        var step = Math.max(1, (parseFloat(brushInput && brushInput.value) || 3) / 100 * Math.min(W, H) / 8);
        for (var t = step; t <= dist; t += step) stamp(last[0] + dx * t / dist, last[1] + dy * t / dist);
        last = p;
    }
    if (maskCanvas) {
        maskCanvas.addEventListener('pointerdown', function (e) {
            if (!maskMode) return;
            painting = true; maskDirty = true; last = null;
            maskCanvas.setPointerCapture(e.pointerId);
            strokeTo(maskPoint(e)); e.preventDefault();
        });
        maskCanvas.addEventListener('pointermove', function (e) { if (painting) strokeTo(maskPoint(e)); });
        var stopPaint = function () { painting = false; last = null; mctx.globalCompositeOperation = 'source-over'; };
        maskCanvas.addEventListener('pointerup', stopPaint);
        maskCanvas.addEventListener('pointercancel', stopPaint);
    }
    var clearMask = document.querySelector('[data-scene-mask-clear]');
    if (clearMask) clearMask.addEventListener('click', function () { mctx.clearRect(0, 0, W, H); maskDirty = true; });

    // Photo pixels under the painted mask -> transparent PNG -> overlay file input.
    function buildOverlay() {
        return new Promise(function (resolve, reject) {
            var out = document.createElement('canvas'); out.width = W; out.height = H;
            var c = out.getContext('2d');
            c.drawImage(photo, 0, 0, W, H);
            c.globalCompositeOperation = 'destination-in';
            c.drawImage(maskCanvas, 0, 0);
            out.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('toBlob')); }, 'image/png');
        });
    }
    var overlayReady = false;
    if (overlayInput && maskCanvas) overlayInput.addEventListener('change', function () {
        var file = overlayInput.files && overlayInput.files[0];
        if (!file || !/image\/(png|webp)/.test(file.type)) return;
        maskDirty = false; // a hand-picked file wins over the painted mask
        maskFromImage(URL.createObjectURL(file));
    });
    if (form && maskCanvas && overlayInput && window.DataTransfer) form.addEventListener('submit', function (e) {
        if (!maskDirty || overlayReady || overlayInput.files.length) return;
        e.preventDefault();
        var btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
        buildOverlay().then(function (blob) {
            var dt = new DataTransfer();
            dt.items.add(new File([blob], 'overlay.png', { type: 'image/png' }));
            overlayInput.files = dt.files;
            overlayReady = true;
            form.requestSubmit ? form.requestSubmit() : form.submit();
        }).catch(function (err) {
            console.error(err);
            if (btn) btn.disabled = false;
            alert('ساخت لایهٔ جلو ناموفق بود؛ دوباره تلاش کنید.');
        });
    });

    setMode('corners');
})();
