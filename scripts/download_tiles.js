const https = require('https');
const fs = require('fs');
const path = require('path');

const urls = [
  'https://unsplash.com/photos/SeS08Ow9Lu0',
  'https://unsplash.com/photos/T3WvaiVHWx4',
  'https://unsplash.com/photos/xU_a0JilD9E',
  'https://unsplash.com/photos/YtHLf4k-N1Q'
];

const destDir = path.join(__dirname, '..', 'public', 'uploads', 'tiles');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Node.js' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk.toString('utf8'));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
}

function downloadFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    const req = https.get(url, { headers: { 'User-Agent': 'Node.js' } }, res => {
      if (res.statusCode >= 300 && res.headers.location) {
        // follow redirects
        return downloadFile(res.headers.location, outPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', err => {
      fs.unlink(outPath, () => reject(err));
    });
  });
}

(async () => {
  for (const pageUrl of urls) {
    try {
      console.log('Fetching', pageUrl);
      const html = await fetchText(pageUrl);
      const m = html.match(/property=(?:\"|\')og:image(?:\"|\') content=(?:\"|\')([^\"']+)(?:\"|\')/i)
        || html.match(/property=(?:\"|\')og:image(?:\"|\') content=([^>\s]+)/i)
        || html.match(/<meta[^>]*content=(?:\"|\')([^\"']+)(?:\"|\')[^>]*property=(?:\"|\')og:image(?:\"|\')/i);
      if (!m || !m[1]) { console.warn('og:image not found for', pageUrl); continue; }
      const imgUrl = m[1];
      const urlObj = new URL(imgUrl);
      const filename = path.basename(urlObj.pathname) || `${Date.now()}.jpg`;
      const outPath = path.join(destDir, filename);
      console.log('Downloading', imgUrl, '->', outPath);
      await downloadFile(imgUrl, outPath);
    } catch (err) {
      console.error('Failed for', pageUrl, err.message || err);
    }
  }
  console.log('Done. Files in', destDir);
  const files = fs.readdirSync(destDir).map(f => ({ f, size: fs.statSync(path.join(destDir, f)).size }));
  console.table(files);
})();
