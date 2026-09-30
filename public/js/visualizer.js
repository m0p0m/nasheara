/* Naghsh Ara room visualiser
   1. Tiles are laid flat on a "wall" canvas, in centimetres, using each
      product's transparent PNG cut-out on the lattice of its shape. A
      product may have several cut-outs, one per colour, which can be
      swapped, mixed at random or painted cell by cell.
   2. For photo scenes the wall plane is fixed by the four corners the admin
      marked (a homography); tiles appear only inside the admin's polygon,
      lit by the photo's own light and shadow. Then the scene's foreground
      overlay is drawn on top.
   Tiles and breeze blocks are different things: a tile is laid ON a wall
   ("wall" scenes); a block BUILDS the wall ("partition" scenes: a partition,
   screen or facade), so through its openings the photo shows what is behind
   it, untouched. Each product only sees scenes of its own kind, plus a
   built-in plain wall / plain screen. */
(function () {
    'use strict';

    var root = document.querySelector('[data-visualizer]');
    if (!root) return;

    var TILES = JSON.parse(root.getAttribute('data-tiles') || '[]');
    var PHOTO_SCENES = JSON.parse(root.getAttribute('data-scenes') || '[]');
    var SHAPES = JSON.parse(root.getAttribute('data-shapes') || '{}');
    var I18N = JSON.parse(root.getAttribute('data-i18n') || '{}');
    var LOCALE = document.documentElement.lang || 'fa';
    // Persian/Arabic digits, with the momayyez (٫) as the decimal separator.
    var localDigits = function (v) { var d = LOCALE === 'ar' ? '٠١٢٣٤٥٦٧٨٩' : '۰۱۲۳۴۵۶۷۸۹'; return LOCALE === 'en' ? String(v) : String(v).replace(/(\d)\.(\d)/g, '$1٫$2').replace(/\d/g, function (c) { return d[c]; }); };
    var stage = root.querySelector('.viz-stage');
    var canvas = root.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);

    var PLAIN = { id: 'plain', kind: 'wall', name: I18N.plain || 'Wall', image: null, overlay: null, quad: [[0, 0], [1, 0], [1, 1], [0, 1]], polygon: null, wallWidthCm: 240, wallHeightCm: 150, lighting: 0 };
    var PLAIN_SCREEN = { id: 'plain-block', kind: 'partition', name: I18N.plainBlock || 'Screen wall', image: null, overlay: null, quad: [[0, 0], [1, 0], [1, 1], [0, 1]], polygon: null, wallWidthCm: 240, wallHeightCm: 150, lighting: 0 };
    var sceneKindFor = function (tile) { return tile && tile.kind === 'block' ? 'partition' : 'wall'; };
    // Per product kind: joint width (cm) and colour a fitter would use.
    var JOINTS = { tile: { width: 0.3, grout: 'light' }, block: { width: 1, grout: 'white' } };
    var GROUTS = { light: '#D9D2C6', sand: '#C9B99F', grey: '#9A9690', dark: '#3C3934', white: '#F3EFE8' };
    var PLAIN_BEHIND = '#7d766c'; // what openings show on the plain wall
    var HOLE_SHADE = 0.45;       // a tile's openings show the wall it is fixed to, in shadow
    // Glaze swatches (same colours as the page's swatch buttons).
    var GLAZE_COLOURS = {
        ruby: '#9B2C1F', amber: '#C98A2E', olive: '#7C8A3C', jade: '#2F5A4A',
        cobalt: '#2B4C8C', plum: '#6E3A5C', ink: '#2B2724', bone: '#EFE6D6'
    };

    // Every colour of every product is addressable as "slug~index".
    var VARIANTS = {};
    TILES.forEach(function (t) {
        if (!t.variants || !t.variants.length) t.variants = [{ label: '', thumb: t.thumb, cutout: t.cutout }];
        t.variants.forEach(function (v, i) { v.id = t.slug + '~' + i; v.spec = t; VARIANTS[v.id] = v; });
    });

    /* ------------------------------------------------------------------ */
    /* WebGL (photo scenes). Without it only the plain wall is offered.    */
    /* ------------------------------------------------------------------ */
    var GL = (function () {
        var c = document.createElement('canvas');
        var gl = c.getContext('webgl', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true }) || c.getContext('experimental-webgl');
        if (!gl) return null;
        function shader(type, src) {
            var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
            return s;
        }
        var vs = shader(gl.VERTEX_SHADER,
            'attribute vec2 a_pos; varying vec2 v_uv;' +
            'void main(){ v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5); gl_Position = vec4(a_pos, 0.0, 1.0); }');
        var fs = shader(gl.FRAGMENT_SHADER,
            'precision mediump float; varying vec2 v_uv;' +
            'uniform sampler2D u_photo; uniform sampler2D u_tiles; uniform sampler2D u_overlay; uniform sampler2D u_mask;' +
            'uniform mat3 u_hinv; uniform vec4 u_rect; uniform float u_light; uniform float u_avgLum; uniform float u_hasOverlay; uniform float u_holeShade; uniform float u_lumBias;' +
            'void main(){' +
            '  vec4 photo = texture2D(u_photo, v_uv);' +
            '  vec3 p = u_hinv * vec3(v_uv, 1.0);' +
            '  vec2 w = p.xy / max(p.z, 1e-5);' +
            // wall units -> the tile canvas, which covers only the area's extent
            '  vec4 tile = texture2D(u_tiles, (w - u_rect.xy) * u_rect.zw);' +
            '  float inside = step(0.0, p.z) * texture2D(u_mask, v_uv).a;' +
            // behind a block wall the photo is scenery, so only its broad light is used
            '  float lum = dot(texture2D(u_photo, v_uv, u_lumBias).rgb, vec3(0.299, 0.587, 0.114));' +
            '  float light = mix(1.0, clamp(lum / max(u_avgLum, 0.05), 0.15, 1.6), u_light);' +
            // tiles are premultiplied: openings keep the photo (darkened for a tile on a wall)
            '  vec3 behind = photo.rgb * mix(1.0, u_holeShade, inside);' +
            '  vec3 col = behind * (1.0 - tile.a * inside) + tile.rgb * light * inside;' +
            '  vec4 ov = texture2D(u_overlay, v_uv);' +
            '  col = col * (1.0 - ov.a * u_hasOverlay) + ov.rgb * u_hasOverlay;' +
            '  gl_FragColor = vec4(col, 1.0);' +
            '}');
        if (!vs || !fs) return null;
        var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return null; }
        gl.useProgram(prog);
        var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        var aPos = gl.getAttribLocation(prog, 'a_pos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        var u = {};
        ['u_photo', 'u_tiles', 'u_overlay', 'u_mask', 'u_hinv', 'u_rect', 'u_light', 'u_avgLum', 'u_hasOverlay', 'u_holeShade', 'u_lumBias'].forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
        gl.uniform1i(u.u_photo, 0); gl.uniform1i(u.u_tiles, 1); gl.uniform1i(u.u_overlay, 2); gl.uniform1i(u.u_mask, 3);
        var aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
        function texture(unit, mipmap) {
            var t = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
            if (mipmap && aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
            return t;
        }
        var tex = { photo: texture(0, true), tiles: texture(1, true), overlay: texture(2, true), mask: texture(3, true) };
        var blank = document.createElement('canvas'); blank.width = blank.height = 1;
        // Colour layers with transparency are premultiplied so filtering never bleeds dark fringes.
        function upload(unit, t, source, premultiply) {
            gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply ? true : false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
            gl.generateMipmap(gl.TEXTURE_2D);
        }
        upload(2, tex.overlay, blank, true);
        return {
            canvas: c,
            setPhoto: function (img) { upload(0, tex.photo, img, false); },
            setMask: function (cv) { upload(3, tex.mask, cv, false); },
            setOverlay: function (img) { upload(2, tex.overlay, img || blank, true); gl.uniform1f(u.u_hasOverlay, img ? 1 : 0); },
            setTiles: function (cv) { upload(1, tex.tiles, cv, true); },
            render: function (w, h, hinv, rect, light, avgLum, partition) {
                if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
                gl.viewport(0, 0, w, h);
                gl.uniformMatrix3fv(u.u_hinv, false, [hinv[0], hinv[3], hinv[6], hinv[1], hinv[4], hinv[7], hinv[2], hinv[5], hinv[8]]);
                gl.uniform4f(u.u_rect, rect.u0, rect.v0, 1 / (rect.u1 - rect.u0), 1 / (rect.v1 - rect.v0));
                gl.uniform1f(u.u_light, light); gl.uniform1f(u.u_avgLum, avgLum); gl.uniform1f(u.u_holeShade, partition ? 1 : HOLE_SHADE); gl.uniform1f(u.u_lumBias, partition ? 5 : 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
        };
    })();

    PHOTO_SCENES.forEach(function (s) { if (s.kind !== 'partition') s.kind = 'wall'; });
    var sceneList = (GL ? PHOTO_SCENES : []).concat([PLAIN, PLAIN_SCREEN]);
    var notice = root.querySelector('[data-notice]');
    if (!GL && PHOTO_SCENES.length && notice) { notice.textContent = I18N.noWebgl || ''; notice.hidden = false; }

    /* ------------------------------------------------------------------ */
    /* Homography: unit square -> quad (Heckbert), and its inverse         */
    /* ------------------------------------------------------------------ */
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
    function apply(m, x, y) { return [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5], m[6] * x + m[7] * y + m[8]]; }
    // Photo fraction -> wall fraction, signed so that z > 0 inside the quad.
    function quadToSquare(q) {
        var inv = adjugate(squareToQuad(q));
        var cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
        if (apply(inv, cx, cy)[2] < 0) inv = inv.map(function (v) { return -v; });
        return inv;
    }
    // Real width/height of the wall from its perspective outline (Zhang & He):
    // two vanishing points give it exactly, one (vertical edges parallel) uses a
    // typical lens, a frontal photo uses the pixel proportions. Heights typed by
    // the admin are ignored on purpose: this can never stretch a tile.
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function wallAspect(q, W, H) {
        var u0 = W / 2, v0 = H / 2;
        var P = function (i) { return [q[i][0] * W - u0, q[i][1] * H - v0, 1]; };
        var m1 = P(0), m2 = P(1), m3 = P(3), m4 = P(2);
        var k2 = dot(cross(m1, m4), m3) / dot(cross(m2, m4), m3);
        var k3 = dot(cross(m1, m4), m2) / dot(cross(m3, m4), m2);
        var n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
        var n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
        var flat2 = Math.abs(n2[2]) < 1e-3, flat3 = Math.abs(n3[2]) < 1e-3;
        var d = function (a, b) { return Math.hypot((a[0] - b[0]) * W, (a[1] - b[1]) * H); };
        var pixelRatio = ((d(q[0], q[1]) + d(q[3], q[2])) / 2) / ((d(q[0], q[3]) + d(q[1], q[2])) / 2);
        if (flat2 && flat3) return pixelRatio;
        var f2 = flat2 || flat3 ? NaN : -(n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2]);
        if (!isFinite(f2) || f2 <= 0) f2 = Math.pow(0.85 * Math.max(W, H), 2);
        var r2 = ((n2[0] * n2[0] + n2[1] * n2[1]) / f2 + n2[2] * n2[2]) / ((n3[0] * n3[0] + n3[1] * n3[1]) / f2 + n3[2] * n3[2]);
        var r = Math.sqrt(r2);
        return isFinite(r) && r > 0.1 && r < 30 ? r : pixelRatio;
    }
    // Even-odd ray casting; works for any simple polygon, convex or not.
    function pointInPolygon(poly, x, y) {
        var inside = false;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            var a = poly[i], b = poly[j];
            if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
        }
        return inside;
    }
    function polygonArea(poly) {
        var s = 0;
        for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; }
        return Math.abs(s) / 2;
    }

    /* ------------------------------------------------------------------ */
    /* State and image caches                                              */
    /* ------------------------------------------------------------------ */
    var state = {
        scene: sceneList[0],
        tile: null,          // product spec
        variant: null,       // colour id "slug~i" laid by default
        mix: false,          // random mix of the colours in mixSet
        mixSet: [],
        brush: null,         // colour id used when painting cells
        layout: 'straight',  // straight | offset | diagonal
        rotation: 'none',    // none | alternate | pinwheel | mirror | random (square tiles)
        grout: 'light',
        groutWidth: 0.3,     // cm
        scale: 1,            // multiplies the tile's physical size
        glaze: 'original',
        paint: {},           // cellKey -> colour id (per-cell overrides)
        painting: false
    };

    var images = {};         // src -> Promise<Image>
    var cutouts = {};        // colourId|glaze -> [canvas, canvas, canvas] brightness variants
    var scenesReady = {};    // scene id -> geometry, textures, light
    var cells = [];          // current tessellation (cm), for hit testing
    var geo = null;          // geometry of the scene being shown

    function loadImage(src) {
        if (!images[src]) images[src] = new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { delete images[src]; reject(new Error(src)); };
            img.src = src;
        });
        return images[src];
    }

    // Resample to power-of-two so the GPU can mipmap it (the stretch is undone
    // by the 0..1 texture coordinates); also gives us pixels for the light average.
    function fitPot(img) {
        var c = document.createElement('canvas');
        var base = window.innerWidth < 700 ? 1024 : 2048; // phones never show more than ~800 device px
        c.width = base; c.height = pot(base * img.naturalHeight / img.naturalWidth, 256, 2048);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c;
    }

    function averageLuminance(photoCanvas, poly) {
        var small = document.createElement('canvas');
        small.width = 160; small.height = Math.max(1, Math.round(160 * photoCanvas.height / photoCanvas.width));
        var c = small.getContext('2d'); c.drawImage(photoCanvas, 0, 0, small.width, small.height);
        var data = c.getImageData(0, 0, small.width, small.height).data;
        var sum = 0, n = 0;
        for (var y = 0; y < small.height; y++) for (var x = 0; x < small.width; x++) {
            if (!pointInPolygon(poly, (x + 0.5) / small.width, (y + 0.5) / small.height)) continue;
            var i = (y * small.width + x) * 4;
            sum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255; n++;
        }
        return n ? sum / n : 0.5;
    }

    // The tiled area on the wall plane: polygon in cm, its bounding box (the
    // extent of the tile canvas) and its real area.
    function plainGeometry(scene) {
        var W = scene.wallWidthCm, H = scene.wallHeightCm;
        return { rect: { u0: 0, v0: 0, u1: 1, v1: 1 }, polyCm: [[0, 0], [W, 0], [W, H], [0, H]], areaM2: W * H / 10000 };
    }
    function photoGeometry(scene, hinv) {
        var poly = scene.polygon && scene.polygon.length >= 3 ? scene.polygon : scene.quad;
        var clampU = function (v) { return Math.max(-3, Math.min(4, v)); };
        var uv = poly.map(function (p) { return apply(hinv, p[0], p[1]); })
            .filter(function (q) { return q[2] > 1e-9; })
            .map(function (q) { return [clampU(q[0] / q[2]), clampU(q[1] / q[2])]; });
        if (uv.length < 3) return plainGeometry(scene);
        var us = uv.map(function (p) { return p[0]; }), vs = uv.map(function (p) { return p[1]; });
        var rect = { u0: Math.min.apply(null, us), v0: Math.min.apply(null, vs), u1: Math.max.apply(null, us), v1: Math.max.apply(null, vs) };
        if (rect.u1 - rect.u0 < 1e-3 || rect.v1 - rect.v0 < 1e-3) return plainGeometry(scene);
        var polyCm = uv.map(function (p) { return [p[0] * scene.wallWidthCm, p[1] * scene.wallHeightCm]; });
        return { rect: rect, polyCm: polyCm, poly: poly, areaM2: polygonArea(polyCm) / 10000 };
    }
    function polygonMask(photo, poly) {
        var c = document.createElement('canvas'); c.width = photo.width; c.height = photo.height;
        var x = c.getContext('2d');
        x.fillStyle = '#fff'; x.beginPath();
        poly.forEach(function (p, i) { var px = p[0] * c.width, py = p[1] * c.height; if (i) x.lineTo(px, py); else x.moveTo(px, py); });
        x.closePath(); x.fill();
        return c;
    }

    function prepareScene(scene) {
        if (!scene.image) return Promise.resolve(null);
        if (scenesReady[scene.id]) return Promise.resolve(scenesReady[scene.id]);
        return Promise.all([loadImage(scene.image), scene.overlay ? loadImage(scene.overlay).catch(function () { return null; }) : null]).then(function (r) {
            var photo = fitPot(r[0]);
            scene.wallHeightCm = scene.wallWidthCm / wallAspect(scene.quad, r[0].naturalWidth, r[0].naturalHeight);
            var hinv = quadToSquare(scene.quad);
            var g = photoGeometry(scene, hinv);
            var poly = g.poly || scene.quad;
            var ready = {
                photo: photo,
                mask: polygonMask(photo, poly),
                overlay: r[1] ? fitPot(r[1]) : null,
                avgLum: averageLuminance(photo, poly),
                ratio: r[0].naturalHeight / r[0].naturalWidth,
                hinv: hinv,
                geo: g
            };
            scenesReady[scene.id] = ready;
            return ready;
        });
    }

    // Outline from the cut-out's alpha, for products whose shape was only
    // guessed from the name. Openings don't matter: only the rim is sampled.
    function detectShape(img) {
        var s = 96, c = document.createElement('canvas');
        var w = img.naturalWidth >= img.naturalHeight ? s : Math.max(8, Math.round(s * img.naturalWidth / img.naturalHeight));
        var h = img.naturalHeight > img.naturalWidth ? s : Math.max(8, Math.round(s * img.naturalHeight / img.naturalWidth));
        c.width = w; c.height = h;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
        var d;
        try { d = x.getImageData(0, 0, w, h).data; } catch (e) { return null; }
        function cov(x0, y0, x1, y1) {
            var sum = 0, n = 0;
            for (var yy = Math.floor(y0 * h); yy < Math.ceil(y1 * h); yy++) for (var xx = Math.floor(x0 * w); xx < Math.ceil(x1 * w); xx++) { sum += d[(yy * w + xx) * 4 + 3]; n++; }
            return n ? sum / n / 255 : 0;
        }
        var corners = [cov(0, 0, 0.06, 0.06), cov(0.94, 0, 1, 0.06), cov(0.94, 0.94, 1, 1), cov(0, 0.94, 0.06, 1)];
        var mids = [cov(0.46, 0, 0.54, 0.07), cov(0.93, 0.46, 1, 0.54), cov(0.46, 0.93, 0.54, 1), cov(0, 0.46, 0.07, 0.54)];
        if (corners.every(function (v) { return v > 0.6; })) return Math.abs(w / h - 1) < 0.12 ? 'square' : 'rectangle';
        if (corners.every(function (v) { return v < 0.3; }) && mids.every(function (v) { return v > 0.45; })) {
            return cov(0.02, 0.36, 0.08, 0.44) > 0.5 && cov(0.92, 0.36, 0.98, 0.44) > 0.5 ? 'hexagon' : 'lozenge';
        }
        return null;
    }

    // CSS filter functions applied to pixels. `ctx.filter` would do this, but
    // Safari (every iPhone browser) ignores it, so glazes never changed colour
    // on phones. Matrices are the Filter Effects spec's, applied in order.
    function filterSteps(str) {
        var steps = [], re = /([a-z-]+)\(([-\d.]+)(deg)?\)/g, m;
        while ((m = re.exec(str))) {
            var v = parseFloat(m[2]), name = m[1], mat = null;
            if (name === 'saturate') {
                mat = [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v,
                       0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v,
                       0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v];
            } else if (name === 'hue-rotate') {
                var a = v * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
                mat = [0.213 + co * 0.787 - si * 0.213, 0.715 - co * 0.715 - si * 0.715, 0.072 - co * 0.072 + si * 0.928,
                       0.213 - co * 0.213 + si * 0.143, 0.715 + co * 0.285 + si * 0.140, 0.072 - co * 0.072 - si * 0.283,
                       0.213 - co * 0.213 - si * 0.787, 0.715 - co * 0.715 + si * 0.715, 0.072 + co * 0.928 + si * 0.072];
            } else if (name === 'brightness') {
                mat = [v, 0, 0, 0, v, 0, 0, 0, v];
            }
            if (mat) steps.push({ m: mat, o: 0 });
            else if (name === 'contrast') steps.push({ m: [v, 0, 0, 0, v, 0, 0, 0, v], o: 255 * (0.5 - 0.5 * v) });
        }
        return steps;
    }
    function applyFilter(c, w, h, str) {
        var steps = filterSteps(str);
        if (!steps.length || (steps.length === 1 && steps[0].m[0] === 1 && !steps[0].o)) return;
        var image;
        try { image = c.getImageData(0, 0, w, h); } catch (e) { return; }
        var d = image.data, clamp = function (x) { return x < 0 ? 0 : x > 255 ? 255 : x; };
        for (var i = 0; i < d.length; i += 4) {
            if (!d[i + 3]) continue;
            var r = d[i], g = d[i + 1], b = d[i + 2];
            for (var s = 0; s < steps.length; s++) {
                var m = steps[s].m, o = steps[s].o;
                var nr = clamp(m[0] * r + m[1] * g + m[2] * b + o);
                var ng = clamp(m[3] * r + m[4] * g + m[5] * b + o);
                b = clamp(m[6] * r + m[7] * g + m[8] * b + o); r = nr; g = ng;
            }
            d[i] = r; d[i + 1] = g; d[i + 2] = b;
        }
        c.putImageData(image, 0, 0);
    }

    // Bounding box of the opaque pixels (alpha > 16).
    function alphaBox(cv) {
        var d;
        try { d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; } catch (e) { return { x: 0, y: 0, w: cv.width, h: cv.height }; }
        var x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
        for (var y = 0; y < cv.height; y++) for (var x = 0; x < cv.width; x++) {
            if (d[(y * cv.width + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        return x1 < 0 ? { x: 0, y: 0, w: cv.width, h: cv.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }

    // Re-glaze a tile: every pixel takes the glaze colour, scaled by how light
    // or dark it is relative to the tile's average (so relief, crackle and edges
    // keep their shading), and the brightest reflections stay as they are, the
    // way a glossy glaze catches light whatever its colour.
    function recolour(ctx, w, h, hex) {
        var t = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
        var image;
        try { image = ctx.getImageData(0, 0, w, h); } catch (e) { return; }
        var d = image.data, sum = 0, n = 0, i;
        for (i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; }
        var mean = n ? sum / n : 128;
        var lo = mean * 1.18, hi = mean * 1.6;
        for (i = 0; i < d.length; i += 4) {
            if (!d[i + 3]) continue;
            var L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            var shade = Math.min(1.35, L / mean);
            var k = Math.max(0, Math.min(1, (L - lo) / (hi - lo)));
            // a reflection is bright AND nearly white; light patches of a coloured glaze are re-glazed too
            var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
            var white = Math.max(0, Math.min(1, 1 - (mx ? (mx - mn) / mx : 0) * 3));
            var spec = k * k * (3 - 2 * k) * white;
            for (var c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, t[c] * shade * (1 - spec) + d[i + c] * spec));
        }
        ctx.putImageData(image, 0, 0);
    }

    // Three brightness variants per cut-out so neighbouring tiles differ a
    // little, as real glaze batches do. The glaze filter is baked in too.
    function prepareCutout(colourId, glazeId) {
        var colour = VARIANTS[colourId], spec = colour.spec;
        var key = colourId + '|' + glazeId;
        if (cutouts[key]) return Promise.resolve(cutouts[key]);
        return loadImage(colour.cutout).then(function (img) {
            var s = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
            var fw = Math.max(1, Math.round(img.naturalWidth * s)), fh = Math.max(1, Math.round(img.naturalHeight * s));
            var full = document.createElement('canvas'); full.width = fw; full.height = fh;
            full.getContext('2d').drawImage(img, 0, 0, fw, fh);
            // Empty margins around the tile would read as extra grout: crop to the tile itself.
            var box = alphaBox(full);
            var w = box.w, h = box.h;
            // The PNG *is* the tile outline, so its proportions define the height;
            // only the physical width comes from the admin. All colours of one
            // design share the first one's proportions.
            if (!spec.aspectFrom) { spec.aspectFrom = colourId; spec.height = spec.width * h / w; }
            if (!spec.shapeExplicit && !spec.shapeChecked) {
                spec.shapeChecked = true;
                var detected = detectShape(img);
                if (detected) spec.shape = detected;
            }
            var base = document.createElement('canvas'); base.width = w; base.height = h;
            base.getContext('2d').drawImage(full, box.x, box.y, w, h, 0, 0, w, h);
            if (GLAZE_COLOURS[glazeId]) recolour(base.getContext('2d'), w, h, GLAZE_COLOURS[glazeId]);
            var variants = [0.95, 1, 1.05].map(function (b) {
                var out = document.createElement('canvas'); out.width = w; out.height = h;
                var c = out.getContext('2d');
                c.drawImage(base, 0, 0);
                applyFilter(c, w, h, 'brightness(' + b + ')');
                return out;
            });
            cutouts[key] = variants;
            return variants;
        }).catch(function () {
            // Missing file: a flat brass tile in the right outline keeps the layout readable.
            var out = document.createElement('canvas'); out.width = 256; out.height = Math.round(256 * spec.height / spec.width);
            var c = out.getContext('2d');
            c.fillStyle = '#B08D57'; c.beginPath(); PATHS[spec.shape](c, out.width / 2, out.height / 2, out.width, out.height); c.fill();
            cutouts[key] = [out, out, out];
            return cutouts[key];
        });
    }

    /* ------------------------------------------------------------------ */
    /* Lattices: cells { key, c, r, cx, cy, w, h, iw, ih, rot, path, order } in cm */
    /* ------------------------------------------------------------------ */
    function rectPath(c, x, y, w, h) { c.rect(x - w / 2, y - h / 2, w, h); }
    function lozengePath(c, x, y, w, h) {
        c.moveTo(x, y - h / 2); c.lineTo(x + w / 2, y); c.lineTo(x, y + h / 2); c.lineTo(x - w / 2, y); c.closePath();
    }
    function hexPath(c, x, y, w, h) {
        // pointy-top hexagon fitted to w (flat-to-flat) and h (point-to-point)
        c.moveTo(x, y - h / 2); c.lineTo(x + w / 2, y - h / 4); c.lineTo(x + w / 2, y + h / 4);
        c.lineTo(x, y + h / 2); c.lineTo(x - w / 2, y + h / 4); c.lineTo(x - w / 2, y - h / 4); c.closePath();
    }
    // Fish scale as it is made and laid: point on top, concave upper sides, round
    // bottom. The concave sides are exactly the round bottoms of the two tiles
    // above, so the scales interlock edge to edge instead of overlapping.
    // Drawn in a unit box (x, y in -1..1) and stretched to w × h.
    function scalePath(c, x, y, w, h) {
        c.save();
        c.translate(x, y); c.scale(w / 2, h / 2);
        c.moveTo(0, -1);
        c.arc(-1, -1, 1, 0, Math.PI / 2, false);     // left side, concave
        c.arc(0, 0, 1, Math.PI, 0, true);            // round bottom
        c.arc(1, -1, 1, Math.PI / 2, Math.PI, false); // right side, concave
        c.closePath();
        c.restore();
    }
    function arabesquePath(c, x, y, w, h) {
        var hw = w / 2, hh = h / 2;
        var c1x = 0.88 * hw, c1y = -0.5 * hh, c2x = 0.22 * hw, c2y = -0.12 * hh;
        c.moveTo(x, y - hh);
        c.bezierCurveTo(x + c1x, y + c1y, x + c2x, y + c2y, x + hw, y);
        c.bezierCurveTo(x + hw - c1x, y + c1y + hh, x + hw - c2x, y + c2y + hh, x, y + hh);
        c.bezierCurveTo(x - hw + c2x, y + c2y + hh, x - hw + c1x, y + c1y + hh, x - hw, y);
        c.bezierCurveTo(x - c2x, y + c2y, x - c1x, y + c1y, x, y - hh);
        c.closePath();
    }
    var PATHS = { square: rectPath, rectangle: rectPath, lozenge: lozengePath, hexagon: hexPath, scale: scalePath, arabesque: arabesquePath };
    var OVERLAPPING = { arabesque: true };

    // B = { x0, y0, x1, y1 } in cm. The lattice is anchored at the wall's
    // origin (perspective corner 1), so it does not shift when the area changes.
    function tessellate(spec, B, layout, g) {
        var w = spec.width * state.scale, h = spec.height * state.scale;
        var list = [];
        var shape = spec.shape;
        function span(a0, a1, step) { return [Math.floor(a0 / step) - 2, Math.ceil(a1 / step) + 2]; }
        function push(c, r, cx, cy, path, tw, th, order, rot, iw, ih) {
            if (cx + tw / 2 < B.x0 - 1 || cx - tw / 2 > B.x1 + 1 || cy + th / 2 < B.y0 - 1 || cy - th / 2 > B.y1 + 1) return;
            list.push({ key: c + ':' + r, c: c, r: r, cx: cx, cy: cy, w: tw, h: th, path: path, order: order || 0, rot: rot || 0, iw: iw || tw, ih: ih || th });
        }
        var cs, rs, c, r;
        if (shape === 'square' || shape === 'rectangle') {
            if (layout === 'diagonal' && shape === 'square') {
                // 45° set: the cell is the square's bounding diamond, the image is rotated
                var d = (w + g) * Math.SQRT2;
                cs = span(B.x0, B.x1, d); rs = span(B.y0, B.y1, d / 2);
                for (r = rs[0]; r <= rs[1]; r++) for (c = cs[0]; c <= cs[1]; c++) {
                    push(c, r, c * d + (r & 1 ? d / 2 : 0), r * (d / 2), lozengePath, d - g * Math.SQRT2, d - g * Math.SQRT2, 0, Math.PI / 4, w, w);
                }
            } else {
                var stepX = w + g, stepY = h + g;
                cs = span(B.x0, B.x1, stepX); rs = span(B.y0, B.y1, stepY);
                for (r = rs[0]; r <= rs[1]; r++) for (c = cs[0]; c <= cs[1]; c++) {
                    var off = layout === 'offset' && (r & 1) ? stepX / 2 : 0;
                    push(c, r, c * stepX + stepX / 2 + off, r * stepY + stepY / 2, rectPath, w, h);
                }
            }
        } else if (shape === 'lozenge') {
            var sx = w + g, sy = (h + g) / 2;
            cs = span(B.x0, B.x1, sx); rs = span(B.y0, B.y1, sy);
            for (r = rs[0]; r <= rs[1]; r++) for (c = cs[0]; c <= cs[1]; c++) {
                push(c, r, c * sx + (r & 1 ? sx / 2 : 0), r * sy, lozengePath, w, h);
            }
        } else if (shape === 'hexagon') {
            var hx = w + g, hy = (h + g) * 0.75;
            cs = span(B.x0, B.x1, hx); rs = span(B.y0, B.y1, hy);
            for (r = rs[0]; r <= rs[1]; r++) for (c = cs[0]; c <= cs[1]; c++) {
                push(c, r, c * hx + (r & 1 ? hx / 2 : 0) + hx / 2, r * hy + h / 2, hexPath, w, h);
            }
        } else if (shape === 'scale') {
            // interlocking rows: half a tile high apart, every other row shifted half a tile
            var sxS = w + g, syS = (h + g) / 2;
            cs = span(B.x0, B.x1, sxS); rs = span(B.y0, B.y1, syS);
            for (r = rs[0]; r <= rs[1]; r++) for (c = cs[0]; c <= cs[1]; c++) {
                push(c, r, c * sxS + (r & 1 ? sxS / 2 : 0) + sxS / 2, r * syS + h / 2, scalePath, w, h);
            }
        } else if (shape === 'arabesque') {
            var ax = w + g, ay = (h + g) * 0.5;
            cs = span(B.x0, B.x1, ax); rs = span(B.y0, B.y1, ay);
            for (r = rs[0]; r <= rs[1]; r++) for (c = cs[0]; c <= cs[1]; c++) {
                push(c, r, c * ax + (r & 1 ? ax / 2 : 0) + ax / 2, r * ay, arabesquePath, w, h, r);
            }
        }
        list.sort(function (a, b) { return a.order - b.order; });
        return list;
    }

    // Extra turn / mirror of one square tile, so one design can form larger
    // patterns (pinwheels, mirrored stars…) as installers lay them.
    var PINWHEEL = [[0, 1], [3, 2]];
    function cellTransform(cell) {
        var t = { rot: 0, fx: 1, fy: 1 };
        if (!state.tile || state.tile.shape !== 'square') return t;
        var c = cell.c & 1, r = cell.r & 1;
        switch (state.rotation) {
            case 'alternate': t.rot = (c ^ r) ? Math.PI / 2 : 0; break;
            case 'pinwheel': t.rot = PINWHEEL[r][c] * Math.PI / 2; break;
            case 'mirror': t.fx = c ? -1 : 1; t.fy = r ? -1 : 1; break;
            case 'random': t.rot = Math.floor(hash(cell.key + 'r') * 4) * Math.PI / 2; break;
        }
        return t;
    }

    // The colour a cell shows: painted override, else the mix, else the chosen colour.
    function cellColour(cell) {
        if (state.paint[cell.key]) return state.paint[cell.key];
        if (state.mix && state.mixSet.length > 1) return state.mixSet[Math.floor(hash(cell.key + 'm') * state.mixSet.length) % state.mixSet.length];
        return state.variant;
    }

    /* ------------------------------------------------------------------ */
    /* Flat wall canvas (cm -> power-of-two pixels, so it can be mipmapped) */
    /* ------------------------------------------------------------------ */
    var wall = document.createElement('canvas');
    var wctx = wall.getContext('2d');
    var wallDirty = true;

    function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
    function pot(n, lo, hi) { return Math.min(hi, Math.max(lo, Math.pow(2, Math.round(Math.log(n) / Math.LN2)))); }

    function drawWall() {
        var scene = state.scene, rect = geo.rect;
        var B = { x0: rect.u0 * scene.wallWidthCm, y0: rect.v0 * scene.wallHeightCm, x1: rect.u1 * scene.wallWidthCm, y1: rect.v1 * scene.wallHeightCm };
        var EW = B.x1 - B.x0, EH = B.y1 - B.y0;
        var base = window.innerWidth < 700 ? 1024 : 2048;
        wall.width = base; wall.height = pot(base * EH / EW, 256, 2048);
        var sx = wall.width / EW, sy = wall.height / EH;
        wctx.setTransform(1, 0, 0, 1, 0, 0);
        wctx.clearRect(0, 0, wall.width, wall.height);
        wctx.setTransform(sx, 0, 0, sy, -B.x0 * sx, -B.y0 * sy);
        var grout = GROUTS[state.grout] || GROUTS.light;
        wctx.fillStyle = grout; wctx.fillRect(B.x0, B.y0, EW, EH);
        wctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (var i = 0; i < 600; i++) wctx.fillRect(B.x0 + hash('g' + i) * EW, B.y0 + hash('h' + i) * EH, 0.25, 0.25);

        var g = state.groutWidth;
        cells = tessellate(state.tile, B, state.layout, g);
        var overlapping = OVERLAPPING[state.tile.shape] && g > 0;
        cells.forEach(function (cell) {
            var variants = cutouts[cellColour(cell) + '|' + state.glaze];
            if (!variants) return;
            if (overlapping) {
                wctx.save(); wctx.lineJoin = 'round'; wctx.strokeStyle = grout; wctx.lineWidth = g * 2;
                wctx.beginPath(); cell.path(wctx, cell.cx, cell.cy, cell.w, cell.h); wctx.stroke(); wctx.restore();
            } else {
                // Clear the grout under the tile so its openings stay see-through.
                wctx.save(); wctx.globalCompositeOperation = 'destination-out'; wctx.fillStyle = '#000';
                wctx.beginPath(); cell.path(wctx, cell.cx, cell.cy, cell.w, cell.h); wctx.fill(); wctx.restore();
            }
            var img = variants[Math.floor(hash(cell.key) * 3) % 3];
            var t = cellTransform(cell);
            wctx.save();
            wctx.translate(cell.cx, cell.cy);
            if (cell.rot || t.rot) wctx.rotate(cell.rot + t.rot);
            if (t.fx !== 1 || t.fy !== 1) wctx.scale(t.fx, t.fy);
            wctx.drawImage(img, -cell.iw / 2, -cell.ih / 2, cell.iw, cell.ih);
            wctx.restore();
        });
        wallDirty = false;
    }

    /* ------------------------------------------------------------------ */
    /* Compose to the visible canvas                                       */
    /* ------------------------------------------------------------------ */
    var raf = null, drawId = 0;
    function render() {
        if (raf) return;
        raf = requestAnimationFrame(function () { raf = null; draw(); });
    }
    function invalidate() { wallDirty = true; render(); }

    function neededColours() {
        var needed = {};
        needed[state.variant] = true;
        if (state.mix) state.mixSet.forEach(function (id) { needed[id] = true; });
        Object.keys(state.paint).forEach(function (k) { needed[state.paint[k]] = true; });
        return Object.keys(needed).filter(function (id) { return VARIANTS[id]; });
    }

    function draw() {
        var scene = state.scene, id = ++drawId;
        if (!state.tile) return;
        stage.classList.add('is-loading');
        var work = neededColours().map(function (cid) { return prepareCutout(cid, state.glaze); });
        work.push(prepareScene(scene));
        Promise.all(work).then(function (results) {
            if (id !== drawId) return;
            var ready = results[results.length - 1];
            var nextGeo = ready ? ready.geo : (scene.plainGeo || (scene.plainGeo = plainGeometry(scene)));
            if (nextGeo !== geo) { geo = nextGeo; wallDirty = true; }
            syncLayoutOptions(); // a detected shape may change the allowed layouts
            if (wallDirty) drawWall();

            var cssW = stage.clientWidth;
            var cssH = Math.round(cssW * (ready ? ready.ratio : scene.wallHeightCm / scene.wallWidthCm));
            canvas.style.height = cssH + 'px';
            canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.imageSmoothingQuality = 'high';

            if (ready && GL) {
                GL.setPhoto(ready.photo); GL.setMask(ready.mask); GL.setOverlay(ready.overlay); GL.setTiles(wall);
                GL.render(canvas.width, canvas.height, ready.hinv, geo.rect, scene.lighting, ready.avgLum, scene.kind === 'partition');
                ctx.drawImage(GL.canvas, 0, 0, cssW, cssH);
            } else {
                paintBehind(scene, cssW, cssH);
                ctx.drawImage(wall, 0, 0, cssW, cssH);
            }
            if (compareBtn) compareBtn.hidden = !(ready && GL);
            // On phones the picture stays pinned above the options, unless it is too tall to leave room for them.
            root.classList.toggle('is-tall', window.innerWidth < 1024 && cssH > window.innerHeight * 0.45);
            stage.classList.remove('is-loading');
            updateSummary();
        }).catch(function (err) {
            console.error(err);
            stage.classList.remove('is-loading');
        });
    }

    // What the plain scenes show through openings: a wall in shadow behind a
    // tile, or soft daylight and greenery behind a free-standing block wall.
    function paintBehind(scene, w, h) {
        if (scene.kind !== 'partition') { ctx.fillStyle = PLAIN_BEHIND; ctx.fillRect(0, 0, w, h); return; }
        var g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#f3f1ea'); g.addColorStop(0.55, '#e4e8dc'); g.addColorStop(1, '#c9d1bd');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        for (var i = 0; i < 14; i++) {
            var x = hash('px' + i) * w, y = h * (0.45 + hash('py' + i) * 0.6), r = w * (0.08 + hash('pr' + i) * 0.12);
            var blob = ctx.createRadialGradient(x, y, 0, x, y, r);
            blob.addColorStop(0, 'rgba(96,122,78,0.35)'); blob.addColorStop(1, 'rgba(96,122,78,0)');
            ctx.fillStyle = blob; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Interaction                                                         */
    /* ------------------------------------------------------------------ */
    var scratch = document.createElement('canvas').getContext('2d');
    function cellAt(clientX, clientY) {
        var rect = canvas.getBoundingClientRect();
        var u = (clientX - rect.left) / rect.width, v = (clientY - rect.top) / rect.height;
        var scene = state.scene, ready = scenesReady[scene.id];
        if (!geo) return null;
        if (scene.image) {
            if (!ready) return null;
            var p = apply(ready.hinv, u, v);
            if (p[2] <= 0) return null;
            u = p[0] / p[2]; v = p[1] / p[2];
        }
        var x = u * scene.wallWidthCm, y = v * scene.wallHeightCm;
        if (!pointInPolygon(geo.polyCm, x, y)) return null;
        // later cells are drawn on top, so test in reverse
        for (var i = cells.length - 1; i >= 0; i--) {
            var c = cells[i];
            scratch.beginPath(); c.path(scratch, c.cx, c.cy, c.w, c.h);
            if (scratch.isPointInPath(x, y)) return c;
        }
        return null;
    }

    function paintAt(e) {
        if (!state.brush || !state.tile) return;
        var cell = cellAt(e.clientX, e.clientY);
        if (!cell) return;
        if (state.paint[cell.key] === state.brush) return;
        state.paint[cell.key] = state.brush;
        invalidate();
    }

    canvas.addEventListener('pointerdown', function (e) { if (!state.brush) return; state.painting = true; canvas.setPointerCapture(e.pointerId); paintAt(e); });
    canvas.addEventListener('pointermove', function (e) { if (state.painting) paintAt(e); });
    canvas.addEventListener('pointerup', function () { state.painting = false; });
    canvas.addEventListener('pointercancel', function () { state.painting = false; });

    function bind(selector, event, fn) { root.querySelectorAll(selector).forEach(function (el) { el.addEventListener(event, fn); }); }
    function setActive(selector, attr, value) {
        root.querySelectorAll(selector).forEach(function (el) { var on = el.getAttribute(attr) === value; el.classList.toggle('is-on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }

    // Scene chips are rendered here so the list can drop photo scenes without WebGL.
    var sceneWrap = root.querySelector('[data-scenes]');
    if (sceneWrap) {
        sceneList.forEach(function (scene) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'vz__scene'; b.setAttribute('data-scene', scene.id); b.setAttribute('aria-pressed', 'false');
            if (scene.image) { var img = document.createElement('img'); img.src = scene.thumb || scene.image; img.alt = ''; img.loading = 'lazy'; b.appendChild(img); }
            else { var blank = document.createElement('span'); blank.className = 'vz__scene-blank'; b.appendChild(blank); }
            var name = document.createElement('span'); name.className = 'vz__scene-name'; name.textContent = scene.name; b.appendChild(name);
            b.hidden = true; // shown by showScenesFor()
            b.addEventListener('click', function () {
                state.scene = scene; state.paint = {};
                setActive('[data-scene]', 'data-scene', scene.id);
                invalidate();
            });
            sceneWrap.appendChild(b);
        });
    }

    /* ---------------- colours ---------------- */
    var colourWrap = root.querySelector('[data-colours]');
    var colourGroup = root.querySelector('[data-colour-group]');
    var mixBtn = root.querySelector('[data-mix]');
    var glazeGroup = root.querySelector('[data-glaze-group]');
    function colourName(id) {
        var v = VARIANTS[id];
        return v ? v.spec.name + (v.label ? ' — ' + v.label : '') : id;
    }
    function renderColours() {
        if (!colourWrap || !state.tile) return;
        var list = state.tile.variants;
        colourWrap.innerHTML = '';
        if (colourGroup) colourGroup.hidden = list.length < 2;
        // real colours replace the approximate glaze tint
        if (glazeGroup) glazeGroup.hidden = list.length > 1;
        if (list.length > 1 && state.glaze !== 'original') { state.glaze = 'original'; setActive('[data-glaze]', 'data-glaze', state.glaze); }
        list.forEach(function (v) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'vz__colour'; b.setAttribute('data-colour', v.id); b.title = v.label || '';
            var img = document.createElement('img'); img.src = v.thumb; img.alt = ''; img.loading = 'lazy'; img.width = 44; img.height = 44;
            b.appendChild(img);
            if (v.label) { var s = document.createElement('span'); s.textContent = v.label; b.appendChild(s); }
            b.addEventListener('click', function () { pickColour(v.id); });
            colourWrap.appendChild(b);
        });
        markColours();
    }
    function markColours() {
        root.querySelectorAll('[data-colour]').forEach(function (el) {
            var id = el.getAttribute('data-colour');
            var on = state.brush ? state.brush === id : (state.mix ? state.mixSet.indexOf(id) >= 0 : state.variant === id);
            el.classList.toggle('is-on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        if (mixBtn) { mixBtn.classList.toggle('is-on', state.mix); mixBtn.setAttribute('aria-pressed', state.mix ? 'true' : 'false'); }
        var hint = root.querySelector('[data-mix-hint]'); if (hint) hint.hidden = !state.mix;
    }
    function pickColour(id) {
        if (state.brush) { state.brush = id; markColours(); return; }
        if (state.mix) {
            var at = state.mixSet.indexOf(id);
            if (at >= 0 && state.mixSet.length > 1) state.mixSet.splice(at, 1);
            else if (at < 0) state.mixSet.push(id);
        } else state.variant = id;
        markColours(); invalidate();
    }
    if (mixBtn) mixBtn.addEventListener('click', function () {
        state.mix = !state.mix;
        if (state.mix && state.mixSet.length < 2) state.mixSet = state.tile.variants.map(function (v) { return v.id; });
        markColours(); invalidate();
    });

    // Only scenes of the product's kind; switch scene when the kind changes.
    function showScenesFor(spec, preferredId) {
        var kind = sceneKindFor(spec);
        root.querySelectorAll('[data-scene]').forEach(function (b) {
            var s = sceneList.filter(function (x) { return x.id === b.getAttribute('data-scene'); })[0];
            b.hidden = !s || s.kind !== kind;
        });
        var fits = sceneList.filter(function (s) { return s.kind === kind; });
        var preferred = fits.filter(function (s) { return s.id === preferredId; })[0];
        if (preferred || !state.scene || state.scene.kind !== kind) state.scene = preferred || fits[0];
        setActive('[data-scene]', 'data-scene', state.scene.id);
    }

    function selectTile(spec, preferredScene) {
        var kindChanged = !state.tile || state.tile.kind !== spec.kind;
        state.tile = spec; state.paint = {};
        showScenesFor(spec, preferredScene);
        if (kindChanged) {
            var joint = JOINTS[spec.kind] || JOINTS.tile;
            state.groutWidth = joint.width; state.grout = joint.grout;
            if (groutRange) groutRange.value = joint.width;
            setActive('[data-grout]', 'data-grout', state.grout);
        }
        state.variant = spec.variants[0].id;
        state.mix = false; state.mixSet = [];
        setActive('[data-tile]', 'data-tile', spec.slug);
        renderColours();
        syncLayoutOptions();
        invalidate();
    }

    bind('[data-layout]', 'click', function () { state.layout = this.getAttribute('data-layout'); state.paint = {}; setActive('[data-layout]', 'data-layout', state.layout); invalidate(); });
    bind('[data-rotation]', 'click', function () { state.rotation = this.getAttribute('data-rotation'); setActive('[data-rotation]', 'data-rotation', state.rotation); invalidate(); });
    bind('[data-grout]', 'click', function () { state.grout = this.getAttribute('data-grout'); setActive('[data-grout]', 'data-grout', state.grout); invalidate(); });
    bind('[data-glaze]', 'click', function () { state.glaze = this.getAttribute('data-glaze'); setActive('[data-glaze]', 'data-glaze', state.glaze); invalidate(); });
    bind('[data-tile]', 'click', function () {
        var slug = this.getAttribute('data-tile');
        var spec = TILES.filter(function (t) { return t.slug === slug; })[0];
        if (!spec) return;
        if (state.brush) { state.brush = spec.variants[0].id; setActive('[data-tile]', 'data-tile', slug); markColours(); return; }
        selectTile(spec);
    });
    var groutRange = root.querySelector('[data-grout-width]');
    if (groutRange) groutRange.addEventListener('input', function () { state.groutWidth = parseFloat(this.value); invalidate(); });
    var scaleRange = root.querySelector('[data-scale]');
    if (scaleRange) scaleRange.addEventListener('input', function () { state.scale = parseFloat(this.value); state.paint = {}; invalidate(); });

    var brushBtn = root.querySelector('[data-brush-toggle]');
    if (brushBtn) brushBtn.addEventListener('click', function () {
        if (state.brush) { state.brush = null; brushBtn.classList.remove('is-on'); canvas.classList.remove('is-painting'); setActive('[data-tile]', 'data-tile', state.tile.slug); }
        else { state.brush = state.variant; brushBtn.classList.add('is-on'); canvas.classList.add('is-painting'); }
        brushBtn.setAttribute('aria-pressed', state.brush ? 'true' : 'false');
        var hint = root.querySelector('[data-brush-hint]'); if (hint) hint.hidden = !state.brush;
        markColours();
    });
    var clearBtn = root.querySelector('[data-clear-paint]');
    if (clearBtn) clearBtn.addEventListener('click', function () { state.paint = {}; invalidate(); });

    // Hold to see the room as photographed, release to see the tiles again.
    var compareBtn = root.querySelector('[data-compare]');
    function showOriginal(on) {
        var ready = scenesReady[state.scene.id];
        if (!compareBtn || !ready || !state.scene.image) return;
        compareBtn.classList.toggle('is-on', on);
        compareBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) ctx.drawImage(ready.photo, 0, 0, canvas.width / dpr, canvas.height / dpr);
        else render();
    }
    if (compareBtn) {
        compareBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); compareBtn.setPointerCapture(e.pointerId); showOriginal(true); });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
            compareBtn.addEventListener(ev, function () { if (compareBtn.classList.contains('is-on')) showOriginal(false); });
        });
        compareBtn.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); showOriginal(true); } });
        compareBtn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') showOriginal(false); });
        compareBtn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }

    // The saved picture carries the design's name and the site address, so it
    // still says where it came from when it is forwarded.
    function captioned() {
        var W = canvas.width, H = canvas.height, bar = Math.max(44, Math.round(W * 0.055));
        var out = document.createElement('canvas'); out.width = W; out.height = H + bar;
        var o = out.getContext('2d');
        o.drawImage(canvas, 0, 0);
        o.fillStyle = '#16382E'; o.fillRect(0, H, W, bar);
        var rtl = LOCALE !== 'en', pad = Math.round(bar * 0.45), mid = H + bar / 2;
        var family = rtl ? 'Vazirmatn, Tahoma, sans-serif' : 'Inter, Arial, sans-serif';
        o.textBaseline = 'middle';
        o.fillStyle = '#F6F2E9'; o.font = '700 ' + Math.round(bar * 0.34) + 'px ' + family;
        o.direction = rtl ? 'rtl' : 'ltr'; o.textAlign = rtl ? 'right' : 'left';
        o.fillText((I18N.brand || '') + (state.tile ? ' — ' + state.tile.name : ''), rtl ? W - pad : pad, mid);
        o.fillStyle = '#C4A26B'; o.font = '600 ' + Math.round(bar * 0.3) + 'px ' + family;
        o.direction = 'ltr'; o.textAlign = rtl ? 'left' : 'right';
        o.fillText(window.location.host, rtl ? pad : W - pad, mid);
        return out;
    }

    var dl = root.querySelector('[data-download]');
    if (dl) dl.addEventListener('click', function () {
        captioned().toBlob(function (blob) {
            if (!blob) return;
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'naghsh-ara-' + (state.tile ? state.tile.slug : 'wall') + '.png';
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        }, 'image/png');
    });

    function syncLayoutOptions() {
        var shape = state.tile ? state.tile.shape : 'square';
        root.querySelectorAll('[data-layout]').forEach(function (el) {
            var l = el.getAttribute('data-layout');
            // blocks are stacked or bonded, never set on the diagonal
        var block = state.tile && state.tile.kind === 'block';
        var allowed = shape === 'square' && !block ? true : ((shape === 'square' || shape === 'rectangle') ? l !== 'diagonal' : l === 'straight');
            el.hidden = !allowed;
        });
        var layoutGroup = root.querySelector('[data-layout-group]');
        if (layoutGroup) layoutGroup.hidden = shape !== 'square' && shape !== 'rectangle';
        var rotationGroup = root.querySelector('[data-rotation-group]');
        if (rotationGroup) rotationGroup.hidden = shape !== 'square';
        if (shape !== 'square' && shape !== 'rectangle') state.layout = 'straight';
        if (state.layout === 'diagonal' && (shape === 'rectangle' || block)) state.layout = 'straight';
        setActive('[data-layout]', 'data-layout', state.layout);
        setActive('[data-rotation]', 'data-rotation', state.rotation);
        var shapeLabel = root.querySelector('[data-shape-label]');
        if (shapeLabel && state.tile) shapeLabel.textContent = (SHAPES[shape] && (LOCALE === 'en' ? SHAPES[shape].labelEn : SHAPES[shape].label)) || shape;
    }

    function updateSummary() {
        var el = root.querySelector('[data-summary]');
        if (!el || !state.tile || !geo) return;
        var scene = state.scene;
        var areaM2 = geo.areaM2;
        var counts = {}, total = 0;
        cells.forEach(function (c) {
            if (!pointInPolygon(geo.polyCm, c.cx, c.cy)) return;
            var id = cellColour(c);
            counts[id] = (counts[id] || 0) + 1; total++;
        });
        var parts = Object.keys(counts).map(function (id) { return colourName(id) + ': ' + counts[id]; });
        el.textContent = localDigits((state.tile.kind === 'block' && I18N.summaryBlock ? I18N.summaryBlock : I18N.summary).replace('{area}', areaM2.toFixed(1)).replace('{count}', String(total)) + ' — ' + parts.join(' · '));
        var productLink = root.querySelector('[data-product-link]');
        if (productLink) {
            productLink.href = productLink.getAttribute('data-base') + encodeURIComponent(state.tile.slug);
            productLink.hidden = false;
        }
        var consult = root.querySelector('[data-consult]');
        if (consult) {
            var url = new URL(consult.getAttribute('data-base'), window.location.origin);
            url.searchParams.set('product', state.tile.name);
            var shapeName = SHAPES[state.tile.shape] ? (LOCALE === 'en' ? SHAPES[state.tile.shape].labelEn : SHAPES[state.tile.shape].label) : state.tile.shape;
            url.searchParams.set('note', I18N.consultNote.replace('{shape}', shapeName).replace('{area}', areaM2.toFixed(1)) + ' · ' + scene.name + ' · ' + parts.join(' · '));
            consult.href = url.pathname + url.search;
        }
    }

    // Finer options start folded on phones, where the picture needs the room.
    var more = root.querySelector('[data-more]');
    if (more && window.matchMedia('(min-width: 1024px)').matches) more.open = true;

    // initial state
    var initialSlug = root.getAttribute('data-initial');
    var initialScene = root.getAttribute('data-initial-scene');
    var firstTile = TILES.filter(function (t) { return t.slug === initialSlug; })[0] || TILES[0] || null;
    setActive('[data-grout]', 'data-grout', state.grout);
    setActive('[data-glaze]', 'data-glaze', state.glaze);
    if (firstTile) selectTile(firstTile, initialScene);
    var resizeTimer = null;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 120); });
})();
