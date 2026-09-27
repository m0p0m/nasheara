/* Scene editor (admin)
   - Area: any number of points outlining exactly where tiles go. Drag a
     point, drag the small "+" between two points to add one, double-click
     (or right-click) a point to delete it, or "trace again" and click
     around the wall. A loupe magnifies the photo under the pointer.
   - Perspective: four handles on something that is a real rectangle on the
     wall (its corners, a cabinet line…). They fix the perspective and the
     scale; the guide grid of real 20 cm cells is drawn through them and
     clipped to the area, so the result can be checked before saving.
   - Auto height: the wall's real aspect ratio is recovered from the
     perspective of the four corners (Zhang & He, "Whiteboard scanning").
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
    var loupe = root.querySelector('[data-scene-loupe]');
    var input = document.querySelector('[data-scene-quad]');
    var polyInput = document.querySelector('[data-scene-polygon]');
    var widthInput = document.querySelector('[name="wallWidthCm"]');
    var heightInput = document.querySelector('[name="wallHeightCm"]');
    var form = root.closest('form');
    var DEFAULT = [[0.1, 0.25], [0.9, 0.25], [0.9, 0.7], [0.1, 0.7]];
    var MAX_POINTS = 64;
    var quad = parse(root.getAttribute('data-quad'), 4) || copy(DEFAULT);
    var poly = parse(root.getAttribute('data-polygon'), 0) || copy(quad);
    var W = 1000, H = 1000; // viewBox = photo pixels once it has loaded
    var photoReady = false;
    var mode = 'area';
    var drawing = null;     // points being traced, or null
    var history = [];

    function copy(points) { return points.map(function (p) { return p.slice(); }); }
    function parse(text, exact) {
        try {
            var q = JSON.parse(text);
            if (!Array.isArray(q) || (exact ? q.length !== exact : q.length < 3)) return null;
            if (!q.every(function (p) { return Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]); })) return null;
            return q.map(function (p) { return [+p[0], +p[1]]; });
        } catch (e) { return null; }
    }
    function num(el, fallback) { var v = parseFloat(el && el.value); return isFinite(v) && v > 0 ? v : fallback; }
    function round4(points) { return points.map(function (p) { return [Math.round(p[0] * 10000) / 10000, Math.round(p[1] * 10000) / 10000]; }); }
    function remember() { history.push({ quad: copy(quad), poly: copy(poly) }); if (history.length > 80) history.shift(); }
    function undo() {
        if (drawing) { drawing.pop(); render(); return; }
        var last = history.pop();
        if (!last) return;
        quad = last.quad; poly = last.poly; render();
    }

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
    function adjugate(m) {
        return [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
            m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
            m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
    }
    function project(m, u, v) {
        var w = m[6] * u + m[7] * v + m[8];
        return [(m[0] * u + m[1] * v + m[2]) / w, (m[3] * u + m[4] * v + m[5]) / w];
    }
    function unproject(inv, x, y) {
        var w = inv[6] * x + inv[7] * y + inv[8];
        return [(inv[0] * x + inv[1] * y + inv[2]) / w, (inv[3] * x + inv[4] * y + inv[5]) / w, w];
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

    /* ---------------- SVG layers ---------------- */
    function el(name, attrs, parent) {
        var node = document.createElementNS(NS, name);
        Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
        if (parent) parent.appendChild(node);
        return node;
    }
    var defs = el('defs', {}, svg);
    var clip = el('clipPath', { id: 'scene-area-clip' }, defs);
    var clipShape = el('polygon', {}, clip);
    var grid = el('path', { class: 'scene-editor__grid', 'clip-path': 'url(#scene-area-clip)' }, svg);
    var areaShape = el('polygon', { class: 'scene-editor__outline' }, svg);
    var traceLine = el('polyline', { class: 'scene-editor__trace' }, svg);
    var quadShape = el('polygon', { class: 'scene-editor__quad' }, svg);
    var mids = el('g', {}, svg);
    var verts = el('g', {}, svg);
    var corners = el('g', {}, svg);
    var cornerHandles = [0, 1, 2, 3].map(function (i) {
        var c = el('circle', { class: 'scene-editor__handle', 'data-c': i }, corners);
        var label = el('text', { class: 'scene-editor__label' }, corners);
        label.textContent = ['۱', '۲', '۳', '۴'][i];
        return { circle: c, label: label };
    });

    function pts(points) { return points.map(function (p) { return (p[0] * W) + ',' + (p[1] * H); }).join(' '); }

    // Rebuilds a pool of circles so their count follows the polygon.
    function pool(group, count, cls, attr) {
        while (group.childNodes.length > count) group.removeChild(group.lastChild);
        while (group.childNodes.length < count) el('circle', { class: cls }, group);
        for (var i = 0; i < count; i++) group.childNodes[i].setAttribute(attr, i);
        return group.childNodes;
    }

    function drawGrid() {
        var qpx = quad.map(function (p) { return [p[0] * W, p[1] * H]; });
        var m = squareToQuad(qpx), inv = adjugate(m);
        var wallW = num(widthInput, 240), wallH = num(heightInput, 60);
        // Wall-space extent of the area (clamped so points near the horizon cannot explode it).
        var uv = poly.map(function (p) { return unproject(inv, p[0] * W, p[1] * H); }).filter(function (p) { return p[2] > 0 && isFinite(p[0]) && isFinite(p[1]); });
        uv = uv.concat([[0, 0], [1, 1]]);
        var clampU = function (v) { return Math.max(-3, Math.min(4, v)); };
        var u0 = clampU(Math.min.apply(null, uv.map(function (p) { return p[0]; }))), u1 = clampU(Math.max.apply(null, uv.map(function (p) { return p[0]; })));
        var v0 = clampU(Math.min.apply(null, uv.map(function (p) { return p[1]; }))), v1 = clampU(Math.max.apply(null, uv.map(function (p) { return p[1]; })));
        var su = 20 / wallW, sv = 20 / wallH, d = '';
        var i0 = Math.floor(u0 / su), i1 = Math.ceil(u1 / su), j0 = Math.floor(v0 / sv), j1 = Math.ceil(v1 / sv);
        if (i1 - i0 > 150 || j1 - j0 > 150) { grid.setAttribute('d', ''); return; }
        for (var i = i0; i <= i1; i++) { var a = project(m, i * su, v0), b = project(m, i * su, v1); d += 'M' + a[0] + ' ' + a[1] + 'L' + b[0] + ' ' + b[1]; }
        for (var j = j0; j <= j1; j++) { var c = project(m, u0, j * sv), e = project(m, u1, j * sv); d += 'M' + c[0] + ' ' + c[1] + 'L' + e[0] + ' ' + e[1]; }
        grid.setAttribute('d', d);
        return { inv: inv, wallW: wallW, wallH: wallH };
    }

    // Real area of the polygon in m², measured on the wall plane.
    function areaM2(info) {
        if (!info) return 0;
        var p = poly.map(function (q) { var r = unproject(info.inv, q[0] * W, q[1] * H); return [r[0] * info.wallW, r[1] * info.wallH]; });
        var s = 0;
        for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
        return Math.abs(s) / 2 / 10000;
    }

    function render() {
        var s = Math.min(W, H);
        var shown = drawing || poly;
        clipShape.setAttribute('points', pts(poly));
        areaShape.setAttribute('points', drawing ? '' : pts(poly));
        traceLine.setAttribute('points', drawing ? pts(drawing) : '');
        quadShape.setAttribute('points', pts(quad));

        var v = pool(verts, shown.length, 'scene-editor__vertex', 'data-v');
        for (var i = 0; i < shown.length; i++) {
            v[i].setAttribute('cx', shown[i][0] * W); v[i].setAttribute('cy', shown[i][1] * H);
            v[i].setAttribute('r', s * (drawing && i === 0 ? 0.016 : 0.011));
            v[i].classList.toggle('is-first', Boolean(drawing) && i === 0);
        }
        var m = pool(mids, drawing ? 0 : poly.length, 'scene-editor__mid', 'data-m');
        for (var k = 0; k < m.length; k++) {
            var a = poly[k], b = poly[(k + 1) % poly.length];
            m[k].setAttribute('cx', (a[0] + b[0]) / 2 * W); m[k].setAttribute('cy', (a[1] + b[1]) / 2 * H); m[k].setAttribute('r', s * 0.007);
        }
        cornerHandles.forEach(function (h, i) {
            h.circle.setAttribute('cx', quad[i][0] * W); h.circle.setAttribute('cy', quad[i][1] * H); h.circle.setAttribute('r', s * 0.018);
            h.label.setAttribute('x', quad[i][0] * W); h.label.setAttribute('y', quad[i][1] * H); h.label.setAttribute('font-size', s * 0.022);
        });

        input.value = JSON.stringify(round4(quad));
        if (polyInput) polyInput.value = JSON.stringify(round4(poly));
        if (photoReady) syncHeight();
        var info = drawGrid();
        var countEl = document.querySelector('[data-scene-point-count]');
        if (countEl) countEl.textContent = (drawing ? drawing.length : poly.length) + ' نقطه' + (info ? ' · مساحت ≈ ' + areaM2(info).toFixed(2) + ' مترمربع' : '');
        var closeBtn = document.querySelector('[data-scene-close]');
        if (closeBtn) closeBtn.hidden = !drawing;
    }

    /* ---------------- pointer handling ---------------- */
    function pointToFraction(e) {
        var r = svg.getBoundingClientRect();
        return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
    }
    function nearFirst(p) {
        if (!drawing || drawing.length < 3) return false;
        var r = svg.getBoundingClientRect();
        return Math.hypot((p[0] - drawing[0][0]) * r.width, (p[1] - drawing[0][1]) * r.height) < 14;
    }
    function finishDrawing() {
        if (!drawing) return;
        if (drawing.length >= 3) { remember(); poly = drawing; }
        drawing = null;
        root.classList.remove('is-tracing');
        render();
    }

    var drag = null; // { list: 'poly'|'quad', i }
    svg.addEventListener('pointerdown', function (e) {
        if (e.button === 2) return;
        var p = pointToFraction(e);
        var t = e.target;
        if (mode === 'area' && drawing) {
            if (nearFirst(p)) { finishDrawing(); return; }
            if (drawing.length < MAX_POINTS) drawing.push(p);
            showLoupe(e, p); render(); e.preventDefault(); return;
        }
        if (mode === 'area' && t.hasAttribute('data-m') && poly.length < MAX_POINTS) {
            remember();
            var at = parseInt(t.getAttribute('data-m'), 10) + 1;
            poly.splice(at, 0, p);
            drag = { list: 'poly', i: at };
        } else if (mode === 'area' && t.hasAttribute('data-v')) {
            remember();
            drag = { list: 'poly', i: parseInt(t.getAttribute('data-v'), 10) };
        } else if (mode === 'perspective' && t.hasAttribute('data-c')) {
            remember();
            drag = { list: 'quad', i: parseInt(t.getAttribute('data-c'), 10) };
        } else return;
        svg.setPointerCapture(e.pointerId);
        showLoupe(e, p);
        e.preventDefault();
        render();
    });
    svg.addEventListener('pointermove', function (e) {
        var p = pointToFraction(e);
        if (drag) {
            (drag.list === 'poly' ? poly : quad)[drag.i] = p;
            showLoupe(e, p); render();
        } else if (drawing) showLoupe(e, p);
    });
    function stopDrag() { drag = null; if (!drawing) hideLoupe(); }
    svg.addEventListener('pointerup', stopDrag);
    svg.addEventListener('pointercancel', stopDrag);
    svg.addEventListener('pointerleave', function () { if (!drag) hideLoupe(); });

    function deleteVertex(t) {
        if (mode !== 'area' || drawing || !t.hasAttribute('data-v') || poly.length <= 3) return false;
        remember();
        poly.splice(parseInt(t.getAttribute('data-v'), 10), 1);
        render();
        return true;
    }
    svg.addEventListener('dblclick', function (e) { if (deleteVertex(e.target)) e.preventDefault(); else if (drawing) finishDrawing(); });
    svg.addEventListener('contextmenu', function (e) { if (deleteVertex(e.target) || drawing) e.preventDefault(); if (drawing) undo(); });

    document.addEventListener('keydown', function (e) {
        if (mode === 'mask' || /input|textarea|select/i.test(document.activeElement && document.activeElement.tagName)) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
        else if (drawing && e.key === 'Enter') { e.preventDefault(); finishDrawing(); }
        else if (drawing && e.key === 'Escape') { drawing = null; root.classList.remove('is-tracing'); hideLoupe(); render(); }
        else if (drawing && e.key === 'Backspace') { e.preventDefault(); undo(); }
    });

    /* ---------------- loupe ---------------- */
    var lctx = loupe ? loupe.getContext('2d') : null;
    function showLoupe(e, p) {
        if (!lctx || !photoReady) return;
        var size = loupe.width, zoom = 3;
        var r = svg.getBoundingClientRect();
        var half = size / 2 / zoom * (W / r.width);
        var x = p[0] * W, y = p[1] * H;
        lctx.clearRect(0, 0, size, size);
        lctx.drawImage(photo, x - half, y - half, half * 2, half * 2, 0, 0, size, size);
        lctx.strokeStyle = 'rgba(225,29,72,0.9)'; lctx.lineWidth = 1.5;
        lctx.beginPath(); lctx.moveTo(size / 2, 0); lctx.lineTo(size / 2, size); lctx.moveTo(0, size / 2); lctx.lineTo(size, size / 2); lctx.stroke();
        // keep out of the way of the pointer
        loupe.classList.toggle('is-right', p[0] < 0.35 && p[1] < 0.45);
        loupe.hidden = false;
    }
    function hideLoupe() { if (loupe) loupe.hidden = true; }

    /* ---------------- buttons ---------------- */
    function on(selector, fn) { var b = document.querySelector(selector); if (b) b.addEventListener('click', fn); }
    on('[data-scene-trace]', function () { drawing = []; root.classList.add('is-tracing'); render(); });
    on('[data-scene-close]', finishDrawing);
    on('[data-scene-undo]', undo);
    on('[data-scene-poly-from-quad]', function () { remember(); poly = copy(quad); render(); });
    on('[data-scene-quad-from-poly]', function () {
        remember();
        var xs = poly.map(function (p) { return p[0]; }), ys = poly.map(function (p) { return p[1]; });
        var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
        quad = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        render();
    });
    on('[data-scene-reset]', function () { remember(); quad = copy(DEFAULT); render(); });
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
    var maskDirty = false, erasing = false, painting = false, last = null;
    var brushInput = document.querySelector('[data-scene-brush]');
    var modeBtns = document.querySelectorAll('[data-scene-mode]');
    var toolBtns = document.querySelectorAll('[data-scene-tool]');
    var overlayInput = document.querySelector('[name="sceneOverlay"]');
    var existingOverlay = root.getAttribute('data-overlay');

    function setMode(next) {
        if (drawing) finishDrawing();
        mode = next;
        root.classList.toggle('is-masking', mode === 'mask');
        root.setAttribute('data-mode', mode);
        modeBtns.forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-scene-mode') === mode); });
        document.querySelectorAll('[data-scene-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-scene-panel') !== mode; });
        render();
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
            if (mode !== 'mask') return;
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
    if (form) form.addEventListener('submit', function (e) {
        if (drawing) finishDrawing();
        if (!maskCanvas || !overlayInput || !window.DataTransfer) return;
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

    setMode('area');
})();
