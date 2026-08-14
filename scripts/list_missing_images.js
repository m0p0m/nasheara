const prisma = require('../lib/prisma');

async function run() {
  try {
    const products = await prisma.product.findMany({ select: { id: true, name: true, slug: true, mainImage: true, galleryImages: true } });
    const projects = await prisma.project.findMany({ select: { id: true, title: true, slug: true, coverImage: true, galleryImages: true } });

    console.log('Products missing mainImage:');
    products.filter(p => !p.mainImage).forEach(p => console.log(`- ${p.id} | ${p.slug} | ${p.name}`));

    console.log('\nProducts with empty galleryImages:');
    products.filter(p => !p.galleryImages || (Array.isArray(p.galleryImages) && p.galleryImages.length === 0)).forEach(p => console.log(`- ${p.id} | ${p.slug} | ${p.name}`));

    console.log('\nProjects missing coverImage:');
    projects.filter(p => !p.coverImage).forEach(p => console.log(`- ${p.id} | ${p.slug} | ${p.title}`));

    console.log('\nProjects with empty galleryImages:');
    projects.filter(p => !p.galleryImages || (Array.isArray(p.galleryImages) && p.galleryImages.length === 0)).forEach(p => console.log(`- ${p.id} | ${p.slug} | ${p.title}`));
  } catch (err) {
    console.error('Error listing records:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
