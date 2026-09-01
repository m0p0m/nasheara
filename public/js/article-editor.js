(function () {
  function insertText(field, before, after, fallback) {
    var start = field.selectionStart;
    var end = field.selectionEnd;
    var selected = field.value.slice(start, end) || fallback || '';
    field.setRangeText(before + selected + after, start, end, 'end');
    field.focus();
    field.dispatchEvent(new Event('input'));
  }

  function createRenderer() {
    var renderer = new marked.Renderer();
    renderer.html = function () { return ''; };
    return renderer;
  }

  document.querySelectorAll('[data-article-editor]').forEach(function (editor) {
    var field = editor.querySelector('textarea');
    var preview = editor.querySelector('[data-preview]');
    var previewButton = editor.querySelector('[data-preview-toggle]');
    var uploadInput = editor.querySelector('[data-image-upload]');

    function refreshPreview() {
      preview.innerHTML = marked.parse(field.value || '', {
        gfm: true,
        breaks: true,
        renderer: createRenderer()
      });
    }

    editor.querySelectorAll('[data-format]').forEach(function (button) {
      button.addEventListener('click', function () {
        var format = button.dataset.format;
        if (format === 'h2') insertText(field, '\n\n## ', '\n\n', 'عنوان بخش');
        if (format === 'h3') insertText(field, '\n\n### ', '\n\n', 'زیرعنوان');
        if (format === 'bold') insertText(field, '**', '**', 'متن مهم');
        if (format === 'italic') insertText(field, '*', '*', 'متن');
        if (format === 'quote') insertText(field, '\n> ', '\n', 'نکته یا نقل‌قول');
        if (format === 'list') insertText(field, '\n- ', '\n', 'مورد فهرست');
        if (format === 'ordered') insertText(field, '\n1. ', '\n', 'مورد فهرست');
        if (format === 'code') insertText(field, '\n```\n', '\n```\n', 'کد یا مشخصات');
        if (format === 'table') insertText(field, '\n| ویژگی | مقدار |\n| --- | --- |\n| ', ' | |\n', 'مشخصات');
        if (format === 'link') {
          var url = window.prompt('آدرس لینک را وارد کنید (https://...)', 'https://');
          if (url) insertText(field, '[', '](' + url + ')', 'متن لینک');
        }
        if (format === 'image') uploadInput.click();
      });
    });

    previewButton.addEventListener('click', function () {
      var isHidden = preview.hidden;
      preview.hidden = !isHidden;
      field.hidden = isHidden;
      previewButton.textContent = isHidden ? 'ویرایش Markdown' : 'پیش‌نمایش';
      if (isHidden) refreshPreview();
    });

    uploadInput.addEventListener('change', async function () {
      var file = uploadInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        window.alert('حجم تصویر باید کمتر از ۵ مگابایت باشد.');
        return;
      }
      var data = new FormData();
      data.append('mainImage', file);
      try {
        var response = await fetch('/admin/articles/upload-image', { method: 'POST', body: data });
        var result = await response.json();
        if (!response.ok) throw new Error(result.error || 'خطا در بارگذاری تصویر');
        insertText(field, '\n\n![', '](' + result.url + ')\n\n', result.alt || 'تصویر مقاله');
      } catch (error) {
        window.alert(error.message || 'بارگذاری تصویر انجام نشد.');
      } finally {
        uploadInput.value = '';
      }
    });
  });
}());
