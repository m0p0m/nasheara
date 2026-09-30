const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeSpecs } = require('../controllers/productController');

test('normalizeSpecs keeps comma-separated lists inside one value', () => {
  assert.deepEqual(
    normalizeSpecs('رنگ‌های قابل تولید: سفید، سبز، مشکی\nضخامت: 10 سانتی‌متر'),
    { 'رنگ‌های قابل تولید': 'سفید، سبز، مشکی', 'ضخامت': '10 سانتی‌متر' }
  );
  assert.deepEqual(normalizeSpecs('Colors: Green, Blue, Cream'), { Colors: 'Green, Blue, Cream' });
});

test('normalizeSpecs still splits entries on newlines, semicolons and comma + key', () => {
  assert.deepEqual(
    normalizeSpecs('ولتاژ:20;توان:100W، وزن: 2 kg\nمقاومت فشاری: 200 kg/cm²'),
    { 'ولتاژ': '20', 'توان': '100W', 'وزن': '2 kg', 'مقاومت فشاری': '200 kg/cm²' }
  );
  assert.deepEqual(normalizeSpecs('{"a":"1"}'), { a: '1' });
  assert.deepEqual(normalizeSpecs(''), {});
});
