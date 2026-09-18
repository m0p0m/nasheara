(function () {
    'use strict';

    var toggleButton = document.getElementById('mobileSidebarToggle');
    var closeButton = document.getElementById('mobileSidebarClose');
    var sidebar = document.getElementById('mobileSidebar');
    var overlay = document.getElementById('mobileSidebarOverlay');
    var panel = document.getElementById('mobileSidebarPanel');

    if (toggleButton && sidebar && overlay && panel) {
        var openSidebar = function () {
            sidebar.classList.remove('pointer-events-none');
            overlay.classList.remove('opacity-0');
            overlay.classList.add('opacity-100');
            panel.classList.remove('translate-x-full');
            document.body.classList.add('overflow-hidden');
        };
        var closeSidebar = function () {
            panel.classList.add('translate-x-full');
            overlay.classList.remove('opacity-100');
            overlay.classList.add('opacity-0');
            document.body.classList.remove('overflow-hidden');
            setTimeout(function () { sidebar.classList.add('pointer-events-none'); }, 300);
        };
        toggleButton.addEventListener('click', openSidebar);
        overlay.addEventListener('click', closeSidebar);
        document.querySelectorAll('[data-mobile-close]').forEach(function (el) {
            el.addEventListener('click', closeSidebar);
        });
        if (closeButton) closeButton.addEventListener('click', closeSidebar);
    }

    document.querySelectorAll('form[data-confirm]').forEach(function (form) {
        form.addEventListener('submit', function (e) {
            if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
        });
    });

    /* Instant preview for every image file input: thumbnails appear under the
       field as soon as a file is picked, before anything is saved. Inputs that
       only accept transparent formats warn about JPEGs right away, because the
       server silently drops them. */
    var fmt = function (bytes) { return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB'; };
    document.querySelectorAll('input[type="file"]').forEach(function (input) {
        var accept = input.getAttribute('accept') || '';
        if (input.hidden || !/image/.test(accept)) return;
        var box = document.createElement('div');
        box.className = 'file-preview';
        box.hidden = true;
        input.insertAdjacentElement('afterend', box);
        var urls = [];
        var alphaOnly = /png|webp/.test(accept) && !/jpeg/.test(accept);
        input.addEventListener('change', function () {
            urls.forEach(function (u) { URL.revokeObjectURL(u); });
            urls = [];
            box.innerHTML = '';
            var files = Array.prototype.slice.call(input.files || []);
            box.hidden = !files.length;
            files.forEach(function (file) {
                var item = document.createElement('figure');
                item.className = 'file-preview__item';
                var bad = alphaOnly && !/image\/(png|webp)/.test(file.type);
                if (/^image\//.test(file.type)) {
                    var url = URL.createObjectURL(file);
                    urls.push(url);
                    var img = document.createElement('img');
                    img.src = url; img.alt = '';
                    item.appendChild(img);
                }
                var cap = document.createElement('figcaption');
                cap.textContent = file.name + ' · ' + fmt(file.size);
                if (bad) { cap.textContent += ' — این فایل شفافیت ندارد و ذخیره نخواهد شد؛ PNG یا WebP انتخاب کنید.'; item.classList.add('is-bad'); }
                else if (file.size > 5 * 1048576) { cap.textContent += ' — بزرگ‌تر از ۵ مگابایت است و آپلود نمی‌شود.'; item.classList.add('is-bad'); }
                item.appendChild(cap);
                box.appendChild(item);
            });
        });
    });
})();
