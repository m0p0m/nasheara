const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

async function run() {
  const products = await prisma.product.findMany({ select: { id: true, slug: true, name: true } });
  const projects = await prisma.project.findMany({ select: { id: true, slug: true, title: true } });

  const rows = [];
  rows.push('type,id,slug,title,main_suggested,gallery_suggested_example');
  for (const p of products) {
    const main = `product-${p.slug}-main.jpg`;
    const galleryExample = `product-${p.slug}-gallery-1.jpg; product-${p.slug}-gallery-2.jpg`;
    rows.push([`product`, p.id, p.slug, (p.name||'').replace(/,/g, ' '), main, galleryExample].join(','));
  }
  for (const pr of projects) {
    const cover = `project-${pr.slug}-cover.jpg`;
    const galleryExample = `project-${pr.slug}-gallery-1.jpg; project-${pr.slug}-gallery-2.jpg`;
    rows.push([`project`, pr.id, pr.slug, (pr.title||'').replace(/,/g, ' '), cover, galleryExample].join(','));
  }

  const outPath = path.join(__dirname, '..', 'public', 'uploads', 'image_filename_map.csv');
  fs.writeFileSync(outPath, rows.join('\n'), 'utf8');
  console.log('Wrote', outPath);
  await prisma.$disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
