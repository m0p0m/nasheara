const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

// This script looks into public/uploads/incoming for files named according to
// the CSV format produced by export_image_filenames.js and updates product/project
// records mainImage and galleryImages accordingly.

const incomingDir = path.join(__dirname, '..', 'public', 'uploads', 'incoming');

async function run() {
  if (!fs.existsSync(incomingDir)) {
    console.error('Incoming directory does not exist:', incomingDir);
    return;
  }
  const files = fs.readdirSync(incomingDir);
  // Expect filenames like product-<slug>-main.jpg or product-<slug>-gallery-1.jpg
  const map = {};
  files.forEach(f => {
    const m = f.match(/^(product|project)-([a-z0-9-]+)-(main|cover|gallery-\d+)\.(jpg|jpeg|png|webp)$/i);
    if (!m) return;
    const [, type, slug, role] = m;
    map[type] ??= {};
    map[type][slug] ??= { main: null, gallery: [] };
    if (role === 'main' || role === 'cover') map[type][slug].main = `/uploads/incoming/${f}`;
    else if (role.startsWith('gallery')) map[type][slug].gallery.push(`/uploads/incoming/${f}`);
  });

  for (const type of Object.keys(map)) {
    for (const slug of Object.keys(map[type])) {
      const entry = map[type][slug];
      try {
        if (type === 'product') {
          const product = await prisma.product.findUnique({ where: { slug } });
          if (!product) { console.warn('Product not found for slug', slug); continue }
          const updates = {};
          if (entry.main) updates.mainImage = entry.main;
          if (entry.gallery && entry.gallery.length) updates.galleryImages = (product.galleryImages || []).concat(entry.gallery);
          if (Object.keys(updates).length) {
            await prisma.product.update({ where: { id: product.id }, data: updates });
            console.log('Updated product', slug);
          }
        } else if (type === 'project') {
          const project = await prisma.project.findUnique({ where: { slug } });
          if (!project) { console.warn('Project not found for slug', slug); continue }
          const updates = {};
          if (entry.main) updates.coverImage = entry.main;
          if (entry.gallery && entry.gallery.length) updates.galleryImages = (project.galleryImages || []).concat(entry.gallery);
          if (Object.keys(updates).length) {
            await prisma.project.update({ where: { id: project.id }, data: updates });
            console.log('Updated project', slug);
          }
        }
      } catch (err) {
        console.error('Failed updating', type, slug, err.message || err);
      }
    }
  }
  await prisma.$disconnect();
}

run();
