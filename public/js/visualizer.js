/* Naghsh Ara room visualiser
   1. Tiles are laid flat on a "wall" canvas, in centimetres, using each
      product's transparent PNG cut-out on the lattice of its shape.
   2. For photo scenes the wall is warped onto the four corners the admin
      marked (a homography) and lit by the photo's own light and shadow,
      then the scene's foreground overlay is drawn on top.
   The built-in "plain wall" shows the flat canvas directly. */
(function () {
    'use strict';

    var root = document.querySelector('[data-visualizer]');
    if (!root) return;

    var TILES = JSON.parse(root.getAttribute('data-tiles') || '[]');
    var PHOTO_SCENES = JSON.parse(root.getAttribute('data-scenes') || '[]');
    var SHAPES = JSON.parse(root.getAttribute('data-shapes') || '{}');
    var I18N = JSON.parse(root.getAttribute('data-i18n') || '{}');
    var LOCALE = document.documentElement.lang || 'fa';
    var localDigits = function (v) { var d = LOCALE === 'ar' ? '٠١٢٣٤٥٦٧٨٩' : '۰۱۲۳۴۵۶۷۸۹'; return LOCALE === 'en' ? String(v) : String(v).replace(/\d/g, function (c) { return d[c]; }); };
    var stage = root.querySelector('.viz-stage');
    var canvas = root.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);

    var PLAIN = { id: 'plain', name: I18N.plain || 'Wall', image: null, overlay: null, quad: [[0, 0], [1, 0], [1, 1], [0, 1]], wallWidthCm: 240, wallHeightCm: 150, lighting: 0 };
    var GROUTS = { light: '#D9D2C6', sand: '#C9B99F', grey: '#9A9690', dark: '#3C3934', white: '#F3EFE8' };
    var GLAZES = {
        original: 'none',
        ruby: 'hue-rotate(-10deg) saturate(1.25) brightness(0.92)',
        amber: 'hue-rotate(28deg) saturate(1.15) brightness(1.05)',
        olive: 'hue-rotate(70deg) saturate(0.85) brightness(0.95)',
        jade: 'hue-rotate(130deg) saturate(0.9) brightness(0.9)',
        cobalt: 'hue-rotate(200deg) saturate(1.1) brightness(0.9)',
        plum: 'hue-rotate(280deg) saturate(0.95) brightness(0.9)',
        ink: 'saturate(0.35) brightness(0.55) contrast(1.15)',
        bone: 'saturate(0.35) brightness(1.45) contrast(0.9)'
    };

    /* ------------------------------------------------------------------ */
    /* WebGL (photo scenes). Without it only the plain wall is offered.    */
    /* ------------------------------------------------------------------ */
    var GL = (function () {
        var c = document.createElement('canvas');
        var gl = c.getContext('webgl', { premultipliedAlpha: false, antialias: false }) || c.getContext('experimental-webgl');
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
            'uniform sampler2D u_photo; uniform sampler2D u_tiles; uniform sampler2D u_overlay;' +
            'uniform mat3 u_hinv; uniform float u_light; uniform float u_avgLum; uniform float u_hasOverlay;' +
            'void main(){' +
            '  vec4 photo = texture2D(u_photo, v_uv);' +
            '  vec3 p = u_hinv * vec3(v_uv, 1.0);' +
            '  vec2 w = p.xy / max(p.z, 1e-5);' +
            // sampled unconditionally so mip selection stays defined at the edges
            '  vec4 tile = texture2D(u_tiles, w);' +
            // soft edge (about one texel of the wall) so the outline is not aliased
            '  float aa = 0.0015;' +
            '  float inside = step(0.0, p.z) * smoothstep(0.0, aa, w.x) * smoothstep(0.0, aa, 1.0 - w.x) * smoothstep(0.0, aa * 4.0, w.y) * smoothstep(0.0, aa * 4.0, 1.0 - w.y);' +
            '  float lum = dot(photo.rgb, vec3(0.299, 0.587, 0.114));' +
            '  float light = mix(1.0, clamp(lum / max(u_avgLum, 0.05), 0.15, 1.6), u_light);' +
            '  vec3 col = mix(photo.rgb, tile.rgb * light, tile.a * inside);' +
            '  vec4 ov = texture2D(u_overlay, v_uv);' +
            '  col = mix(col, ov.rgb, ov.a * u_hasOverlay);' +
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
        ['u_photo', 'u_tiles', 'u_overlay', 'u_hinv', 'u_light', 'u_avgLum', 'u_hasOverlay'].forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
        gl.uniform1i(u.u_photo, 0); gl.uniform1i(u.u_tiles, 1); gl.uniform1i(u.u_overlay, 2);
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
        var tex = { photo: texture(0, true), tiles: texture(1, true), overlay: texture(2, true) };
        var blank = document.createElement('canvas'); blank.width = blank.height = 1;
        function upload(unit, t, source, mipmap) {
            gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
            if (mipmap) gl.generateMipmap(gl.TEXTURE_2D);
        }
        upload(2, tex.overlay, blank, true);
        return {
            canvas: c,
            setPhoto: function (img) { upload(0, tex.photo, img, true); },
            setOverlay: function (img) { upload(2, tex.overlay, img || blank, true); gl.uniform1f(u.u_hasOverlay, img ? 1 : 0); },
            setTiles: function (cv) { upload(1, tex.tiles, cv, true); },
            render: function (w, h, hinv, light, avgLum) {
                if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
                gl.viewport(0, 0, w, h);
                gl.uniformMatrix3fv(u.u_hinv, false, [hinv[0], hinv[3], hinv[6], hinv[1], hinv[4], hinv[7], hinv[2], hinv[5], hinv[8]]);
                gl.uniform1f(u.u_light, light); gl.uniform1f(u.u_avgLum, avgLum);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
        };
    })();

    var sceneList = (GL ? PHOTO_SCENES : []).concat([PLAIN]);
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
    function pointInQuad(q, x, y) {
        var sign = 0;
        for (var i = 0; i < 4; i++) {
            var a = q[i], b = q[(i + 1) % 4];
            var cross = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
            if (cross === 0) continue;
            if (sign === 0) sign = cross > 0 ? 1 : -1;
            else if ((cross > 0 ? 1 : -1) !== sign) return false;
        }
        return true;
    }

    /* ------------------------------------------------------------------ */
    /* State and image caches                                              */
    /* ------------------------------------------------------------------ */
    var state = {
        scene: sceneList[0],
        tile: null,          // primary tile spec
        brush: null,         // secondary tile spec used when painting cells
        layout: 'straight',  // straight | offset | diagonal
        grout: 'light',
        groutWidth: 0.3,     // cm
        scale: 1,            // multiplies the tile's physical size
        glaze: 'original',
        paint: {},           // cellKey -> tile slug (per-cell overrides)
        painting: false
    };

    var images = {};         // src -> Promise<Image>
    var cutouts = {};        // slug|glaze -> [canvas, canvas, canvas] brightness variants
    var scenesReady = {};    // scene id -> { photo, overlay, avgLum, ratio }
    var cells = [];          // current tessellation (cm), for hit testing

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

    function averageLuminance(photoCanvas, quad) {
        var small = document.createElement('canvas');
        small.width = 160; small.height = Math.max(1, Math.round(160 * photoCanvas.height / photoCanvas.width));
        var c = small.getContext('2d'); c.drawImage(photoCanvas, 0, 0, small.width, small.height);
        var data = c.getImageData(0, 0, small.width, small.height).data;
        var sum = 0, n = 0;
        for (var y = 0; y < small.height; y++) for (var x = 0; x < small.width; x++) {
            if (!pointInQuad(quad, (x + 0.5) / small.width, (y + 0.5) / small.height)) continue;
            var i = (y * small.width + x) * 4;
            sum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255; n++;
        }
        return n ? sum / n : 0.5;
    }

    function prepareScene(scene) {
        if (!scene.image) return Promise.resolve(null);
        if (scenesReady[scene.id]) return Promise.resolve(scenesReady[scene.id]);
        return Promise.all([loadImage(scene.image), scene.overlay ? loadImage(scene.overlay).catch(function () { return null; }) : null]).then(function (r) {
            var photo = fitPot(r[0]);
            scene.wallHeightCm = scene.wallWidthCm / wallAspect(scene.quad, r[0].naturalWidth, r[0].naturalHeight);
            var ready = {
                photo: photo,
                overlay: r[1] ? fitPot(r[1]) : null,
                avgLum: averageLuminance(photo, scene.quad),
                ratio: r[0].naturalHeight / r[0].naturalWidth,
                hinv: quadToSquare(scene.quad)
            };
            scenesReady[scene.id] = ready;
            return ready;
        });
    }

    // Three brightness variants per cut-out so neighbouring tiles differ a
    // little, as real glaze batches do. The glaze filter is baked in too.
    function prepareCutout(tile, glazeId) {
        var key = tile.slug + '|' + glazeId;
        if (cutouts[key]) return Promise.resolve(cutouts[key]);
        return loadImage(tile.cutout).then(function (img) {
            var s = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
            var w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
            // The PNG *is* the tile outline, so its proportions define the height;
            // only the physical width comes from the admin.
            tile.height = tile.width * img.naturalHeight / img.naturalWidth;
            var glaze = GLAZES[glazeId] || 'none';
            var variants = [0.95, 1, 1.05].map(function (b) {
                var out = document.createElement('canvas'); out.width = w; out.height = h;
                var c = out.getContext('2d');
                if ('filter' in c) c.filter = (glaze === 'none' ? '' : glaze + ' ') + 'brightness(' + b + ')';
                c.drawImage(img, 0, 0, w, h);
                return out;
            });
            cutouts[key] = variants;
            return variants;
        }).catch(function () {
            // Missing file: a flat brass tile in the right outline keeps the layout readable.
            var out = document.createElement('canvas'); out.width = 256; out.height = Math.round(256 * tile.height / tile.width);
            var c = out.getContext('2d');
            c.fillStyle = '#B08D57'; c.beginPath(); PATHS[tile.shape](c, out.width / 2, out.height / 2, out.width, out.height); c.fill();
            cutouts[key] = [out, out, out];
            return cutouts[key];
        });
    }

    /* ------------------------------------------------------------------ */
    /* Lattices: cells { key, cx, cy, w, h, iw, ih, rot, path, order } in cm */
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
    function scalePath(c, x, y, w, h) {
        var r = w / 2, top = y - h / 2 + r;
        c.moveTo(x - r, top);
        c.arc(x, top, r, Math.PI, 0, false);
        c.lineTo(x, y + h / 2);
        c.closePath();
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
    var OVERLAPPING = { scale: true, arabesque: true };

    function tessellate(spec, W, H, layout, g) {
        var w = spec.width * state.scale, h = spec.height * state.scale;
        var list = [];
        var shape = spec.shape;

        function push(col, row, cx, cy, path, tw, th, order, rot, iw, ih) {
            if (cx + tw / 2 < -1 || cx - tw / 2 > W + 1 || cy + th / 2 < -1 || cy - th / 2 > H + 1) return;
            list.push({ key: col + ':' + row, cx: cx, cy: cy, w: tw, h: th, path: path, order: order || 0, rot: rot || 0, iw: iw || tw, ih: ih || th });
        }

        if (shape === 'square' || shape === 'rectangle') {
            if (layout === 'diagonal' && shape === 'square') {
                // 45° set: the cell is the square's bounding diamond, the image is rotated
                var d = (w + g) * Math.SQRT2;
                var cols = Math.ceil(W / d) + 2, rows = Math.ceil(H / (d / 2)) + 2;
                for (var r = -1; r < rows; r++) for (var c = -1; c < cols; c++) {
                    push(c, r, c * d + (r % 2 ? d / 2 : 0), r * (d / 2), lozengePath, d - g * Math.SQRT2, d - g * Math.SQRT2, 0, Math.PI / 4, w, w);
                }
            } else {
                var stepX = w + g, stepY = h + g;
                var cols2 = Math.ceil(W / stepX) + 2, rows2 = Math.ceil(H / stepY) + 1;
                for (var r2 = 0; r2 < rows2; r2++) for (var c2 = -1; c2 < cols2; c2++) {
                    var off = layout === 'offset' && r2 % 2 ? stepX / 2 : 0;
                    push(c2, r2, c2 * stepX + stepX / 2 + off, r2 * stepY + stepY / 2, rectPath, w, h);
                }
            }
        } else if (shape === 'lozenge') {
            var sx = w + g, sy = (h + g) / 2;
            var colsL = Math.ceil(W / sx) + 2, rowsL = Math.ceil(H / sy) + 2;
            for (var rl = -1; rl < rowsL; rl++) for (var cl = -1; cl < colsL; cl++) {
                push(cl, rl, cl * sx + (rl % 2 ? sx / 2 : 0), rl * sy, lozengePath, w, h);
            }
        } else if (shape === 'hexagon') {
            var hx = w + g, hy = (h + g) * 0.75;
            var colsH = Math.ceil(W / hx) + 2, rowsH = Math.ceil(H / hy) + 2;
            for (var rh = -1; rh < rowsH; rh++) for (var ch = -1; ch < colsH; ch++) {
                push(ch, rh, ch * hx + (rh % 2 ? hx / 2 : 0) + hx / 2, rh * hy + h / 2, hexPath, w, h);
            }
        } else if (shape === 'scale') {
            // scales overlap: rows ~0.9 radius apart, offset by half a tile; lower rows drawn on top
            var r0 = w / 2, sxS = w + g, syS = r0 * 0.92 + g;
            var colsS = Math.ceil(W / sxS) + 2, rowsS = Math.ceil(H / syS) + 3;
            for (var rs = -2; rs < rowsS; rs++) for (var cs = -1; cs < colsS; cs++) {
                push(cs, rs, cs * sxS + (rs % 2 ? sxS / 2 : 0) + sxS / 2, rs * syS - r0 + h / 2, scalePath, w, h, rs);
            }
        } else if (shape === 'arabesque') {
            var ax = w + g, ay = (h + g) * 0.5;
            var colsA = Math.ceil(W / ax) + 2, rowsA = Math.ceil(H / ay) + 2;
            for (var ra = -1; ra < rowsA; ra++) for (var ca = -1; ca < colsA; ca++) {
                push(ca, ra, ca * ax + (ra % 2 ? ax / 2 : 0) + ax / 2, ra * ay, arabesquePath, w, h, ra);
            }
        }
        list.sort(function (a, b) { return a.order - b.order; });
        return list;
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
        var scene = state.scene, W = scene.wallWidthCm, H = scene.wallHeightCm;
        var base = window.innerWidth < 700 ? 1024 : 2048;
        wall.width = base; wall.height = pot(base * H / W, 256, 2048);
        wctx.setTransform(wall.width / W, 0, 0, wall.height / H, 0, 0);
        var grout = GROUTS[state.grout] || GROUTS.light;
        wctx.fillStyle = grout; wctx.fillRect(0, 0, W, H);
        wctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (var i = 0; i < 600; i++) wctx.fillRect(hash('g' + i) * W, hash('h' + i) * H, 0.25, 0.25);

        var g = state.groutWidth;
        cells = tessellate(state.tile, W, H, state.layout, g);
        var overlapping = OVERLAPPING[state.tile.shape] && g > 0;
        cells.forEach(function (cell) {
            var slug = state.paint[cell.key] || state.tile.slug;
            var variants = cutouts[slug + '|' + state.glaze];
            if (!variants) return;
            if (overlapping) {
                wctx.save(); wctx.lineJoin = 'round'; wctx.strokeStyle = grout; wctx.lineWidth = g * 2;
                wctx.beginPath(); cell.path(wctx, cell.cx, cell.cy, cell.w, cell.h); wctx.stroke(); wctx.restore();
            }
            var img = variants[Math.floor(hash(cell.key) * 3) % 3];
            wctx.save();
            wctx.translate(cell.cx, cell.cy);
            if (cell.rot) wctx.rotate(cell.rot);
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

    function draw() {
        var scene = state.scene, id = ++drawId;
        if (!state.tile) return;
        stage.classList.add('is-loading');
        var specs = {}; TILES.forEach(function (t) { specs[t.slug] = t; });
        var needed = { }; needed[state.tile.slug] = true;
        Object.keys(state.paint).forEach(function (k) { needed[state.paint[k]] = true; });
        var work = Object.keys(needed).filter(function (s) { return specs[s]; }).map(function (s) { return prepareCutout(specs[s], state.glaze); });
        work.push(prepareScene(scene));
        Promise.all(work).then(function (results) {
            if (id !== drawId) return;
            var ready = results[results.length - 1];
            if (wallDirty) drawWall();

            var cssW = stage.clientWidth;
            var cssH = Math.round(cssW * (ready ? ready.ratio : scene.wallHeightCm / scene.wallWidthCm));
            canvas.style.height = cssH + 'px';
            canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.imageSmoothingQuality = 'high';

            if (ready && GL) {
                GL.setPhoto(ready.photo); GL.setOverlay(ready.overlay); GL.setTiles(wall);
                GL.render(canvas.width, canvas.height, ready.hinv, scene.lighting, ready.avgLum);
                ctx.drawImage(GL.canvas, 0, 0, cssW, cssH);
            } else {
                ctx.drawImage(wall, 0, 0, cssW, cssH);
            }
            stage.classList.remove('is-loading');
            updateSummary();
        }).catch(function (err) {
            console.error(err);
            stage.classList.remove('is-loading');
        });
    }

    /* ------------------------------------------------------------------ */
    /* Interaction                                                         */
    /* ------------------------------------------------------------------ */
    var scratch = document.createElement('canvas').getContext('2d');
    function cellAt(clientX, clientY) {
        var rect = canvas.getBoundingClientRect();
        var u = (clientX - rect.left) / rect.width, v = (clientY - rect.top) / rect.height;
        var scene = state.scene, ready = scenesReady[scene.id];
        if (scene.image) {
            if (!ready) return null;
            var p = apply(ready.hinv, u, v);
            if (p[2] <= 0) return null;
            u = p[0] / p[2]; v = p[1] / p[2];
        }
        if (u < 0 || u > 1 || v < 0 || v > 1) return null;
        var x = u * scene.wallWidthCm, y = v * scene.wallHeightCm;
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
        if (state.brush.slug === state.tile.slug) delete state.paint[cell.key];
        else state.paint[cell.key] = state.brush.slug;
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
            b.addEventListener('click', function () {
                state.scene = scene; state.paint = {};
                setActive('[data-scene]', 'data-scene', scene.id);
                invalidate();
            });
            sceneWrap.appendChild(b);
        });
    }

    bind('[data-layout]', 'click', function () { state.layout = this.getAttribute('data-layout'); state.paint = {}; setActive('[data-layout]', 'data-layout', state.layout); invalidate(); });
    bind('[data-grout]', 'click', function () { state.grout = this.getAttribute('data-grout'); setActive('[data-grout]', 'data-grout', state.grout); invalidate(); });
    bind('[data-glaze]', 'click', function () { state.glaze = this.getAttribute('data-glaze'); setActive('[data-glaze]', 'data-glaze', state.glaze); invalidate(); });
    bind('[data-tile]', 'click', function () {
        var slug = this.getAttribute('data-tile');
        var spec = TILES.filter(function (t) { return t.slug === slug; })[0];
        if (!spec) return;
        if (state.brush) { state.brush = spec; setActive('[data-tile]', 'data-tile', slug); return; }
        state.tile = spec; state.paint = {};
        setActive('[data-tile]', 'data-tile', slug);
        syncLayoutOptions();
        invalidate();
    });
    var groutRange = root.querySelector('[data-grout-width]');
    if (groutRange) groutRange.addEventListener('input', function () { state.groutWidth = parseFloat(this.value); invalidate(); });
    var scaleRange = root.querySelector('[data-scale]');
    if (scaleRange) scaleRange.addEventListener('input', function () { state.scale = parseFloat(this.value); state.paint = {}; invalidate(); });

    var brushBtn = root.querySelector('[data-brush-toggle]');
    if (brushBtn) brushBtn.addEventListener('click', function () {
        if (state.brush) { state.brush = null; brushBtn.classList.remove('is-on'); canvas.classList.remove('is-painting'); setActive('[data-tile]', 'data-tile', state.tile.slug); }
        else { state.brush = state.tile; brushBtn.classList.add('is-on'); canvas.classList.add('is-painting'); }
        brushBtn.setAttribute('aria-pressed', state.brush ? 'true' : 'false');
        var hint = root.querySelector('[data-brush-hint]'); if (hint) hint.hidden = !state.brush;
    });
    var clearBtn = root.querySelector('[data-clear-paint]');
    if (clearBtn) clearBtn.addEventListener('click', function () { state.paint = {}; invalidate(); });

    var dl = root.querySelector('[data-download]');
    if (dl) dl.addEventListener('click', function () {
        canvas.toBlob(function (blob) {
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
            var allowed = shape === 'square' ? true : (shape === 'rectangle' ? l !== 'diagonal' : l === 'straight');
            el.hidden = !allowed;
        });
        var layoutGroup = root.querySelector('[data-layout-group]');
        if (layoutGroup) layoutGroup.hidden = shape !== 'square' && shape !== 'rectangle';
        if (shape !== 'square' && shape !== 'rectangle') state.layout = 'straight';
        if (shape === 'rectangle' && state.layout === 'diagonal') state.layout = 'offset';
        setActive('[data-layout]', 'data-layout', state.layout);
        var shapeLabel = root.querySelector('[data-shape-label]');
        if (shapeLabel && state.tile) shapeLabel.textContent = (SHAPES[shape] && (LOCALE === 'en' ? SHAPES[shape].labelEn : SHAPES[shape].label)) || shape;
    }

    function updateSummary() {
        var el = root.querySelector('[data-summary]');
        if (!el || !state.tile) return;
        var scene = state.scene;
        var areaM2 = (scene.wallWidthCm * scene.wallHeightCm) / 10000;
        var counts = {};
        cells.forEach(function (c) { var s = state.paint[c.key] || state.tile.slug; counts[s] = (counts[s] || 0) + 1; });
        var parts = Object.keys(counts).map(function (slug) {
            var spec = TILES.filter(function (t) { return t.slug === slug; })[0];
            return (spec ? spec.name : slug) + ': ' + counts[slug];
        });
        el.textContent = localDigits(I18N.summary.replace('{area}', areaM2.toFixed(1)).replace('{count}', String(cells.length)) + ' — ' + parts.join(' · '));
        var consult = root.querySelector('[data-consult]');
        if (consult) {
            var url = new URL(consult.getAttribute('data-base'), window.location.origin);
            url.searchParams.set('product', state.tile.name);
            var shapeName = SHAPES[state.tile.shape] ? (LOCALE === 'en' ? SHAPES[state.tile.shape].labelEn : SHAPES[state.tile.shape].label) : state.tile.shape;
            url.searchParams.set('note', I18N.consultNote.replace('{shape}', shapeName).replace('{area}', areaM2.toFixed(1)) + ' · ' + scene.name);
            consult.href = url.pathname + url.search;
        }
    }

    // initial state
    var initialSlug = root.getAttribute('data-initial');
    var initialScene = root.getAttribute('data-initial-scene');
    state.tile = TILES.filter(function (t) { return t.slug === initialSlug; })[0] || TILES[0] || null;
    state.scene = sceneList.filter(function (s) { return s.id === initialScene; })[0] || sceneList[0];
    if (state.tile) setActive('[data-tile]', 'data-tile', state.tile.slug);
    setActive('[data-scene]', 'data-scene', state.scene.id);
    setActive('[data-grout]', 'data-grout', state.grout);
    setActive('[data-glaze]', 'data-glaze', state.glaze);
    syncLayoutOptions();
    render();
    var resizeTimer = null;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 120); });
})();
