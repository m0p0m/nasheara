require('dotenv').config();
const prisma = require('../lib/prisma');

const backfill = async () => {
    const categories = await prisma.category.findMany();
    for (const item of categories) {
        await prisma.category.update({
            where: { id: item.id },
            data: { translations: item.translations || { fa: { name: item.name, description: item.description }, en: {}, ar: {} } }
        });
    }

    const products = await prisma.product.findMany();
    for (const item of products) {
        await prisma.product.update({
            where: { id: item.id },
            data: { translations: item.translations || { fa: {
                name: item.name, description: item.description, metaTitle: item.metaTitle,
                metaDescription: item.metaDescription, keywords: item.keywords, patternName: item.patternName,
                color: item.color, material: item.material, dimensions: item.dimensions,
                usageArea: item.usageArea, specs: item.specs
            }, en: {}, ar: {} } }
        });
    }

    const projects = await prisma.project.findMany();
    for (const item of projects) {
        await prisma.project.update({
            where: { id: item.id },
            data: { translations: item.translations || { fa: { title: item.title, location: item.location, description: item.description }, en: {}, ar: {} } }
        });
    }

    const articles = await prisma.article.findMany();
    for (const item of articles) {
        await prisma.article.update({
            where: { id: item.id },
            data: { translations: item.translations || { fa: {
                title: item.title, content: item.content, excerpt: item.excerpt, metaTitle: item.metaTitle,
                metaDescription: item.metaDescription, metaKeywords: item.metaKeywords
            }, en: {}, ar: {} } }
        });
    }
    console.log('Existing Prisma records backfilled with fa translations.');
};

backfill().catch(error => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
