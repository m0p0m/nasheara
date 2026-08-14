/**
 * Demo seed for the tile atelier site.
 * Populates MySQL (via Prisma) with realistic patterned-tile products, categories
 * and projects using the existing images in /public/icons so the redesign can be reviewed.
 *
 * Run:  node scripts/seedDemoData.js
 * This DELETES existing products/categories/projects (test data) before seeding.
 */
const { v4: uuidv4 } = require('uuid');
const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const prisma = require('../lib/prisma');
const slugify = require('../utils/slugify');

const IMG = name => `/icons/${name}`;

// --- Categories ----------------------------------------------------------
const CATEGORIES = [
  {
    name: 'کاشی دیوار',
    slug: 'wall-tiles',
    description: 'کاشی‌های دست‌ساز طرح‌دار برای دیوارهای داخلی، دیوار پشت اجاق و نمای فضاها',
    translations: {
      name: { fa: 'کاشی دیوار', en: 'Wall Tiles', ar: 'بلاط الجدران' },
      description: {
        fa: 'کاشی‌های دست‌ساز طرح‌دار برای دیوارهای داخلی، دیوار پشت اجاق و نمای فضاها',
        en: 'Handmade patterned tiles for interior walls, kitchen splashbacks and architectural surfaces',
        ar: 'بلاط يدوي منقوش للجدران الداخلية وجدران المطبخ والأسطح المعمارية'
      }
    }
  },
  {
    name: 'کاشی کف',
    slug: 'floor-tiles',
    description: 'کاشی‌های ضخیم و مقاوم برای کف فضاهای پرتردد و نمایشگاه‌ها',
    translations: {
      name: { fa: 'کاشی کف', en: 'Floor Tiles', ar: 'بلاط الأرضيات' },
      description: {
        fa: 'کاشی‌های ضخیم و مقاوم برای کف فضاهای پرتردد و نمایشگاه‌ها',
        en: 'Durable thicker handmade tiles for high-traffic floors and showrooms',
        ar: 'بلاط سميك ومتين لأرضيات الأماكن عالية الحركة وصالات العرض'
      }
    }
  },
  {
    name: 'کاشی محوطه و فضای باز',
    slug: 'courtyard-tiles',
    description: 'کاشی و اکسسوری فضای باز؛ حیاط، تراس، استخر و حوضچه‌ها',
    translations: {
      name: { fa: 'کاشی محوطه و فضای باز', en: 'Courtyard & Outdoor', ar: 'بلاط الفناء والمساحات الخارجية' },
      description: {
        fa: 'کاشی و اکسسوری فضای باز؛ حیاط، تراس، استخر و حوضچه‌ها',
        en: 'Outdoor tiles and accessories for courtyards, terraces, pools and water features',
        ar: 'بلاط وملحقات للمساحات الخارجية؛ الساحات والشرفات وحمامات السباحة'
      }
    }
  }
];

// --- Products ------------------------------------------------------------
const PRODUCTS = [
  {
    name: 'شمسه فیروزه',
    category: 'کاشی دیوار',
    patternName: 'شمسه',
    color: 'فیروزه‌ای و لاجوردی',
    material: 'سفال دست‌ساز',
    dimensions: '۲۰ × ۲۰ سانتی‌متر',
    usageArea: ['دیوار پشت اجاق', 'دیوار', 'حمام'],
    mainImage: IMG('semi-industrial-4.jpg'),
    galleryImages: [IMG('semi-industrial-4.jpg'), IMG('semi-industrial-3.jpg'), IMG('semi-industrial-5.jpg')],
    description: 'شمسهٔ هشت‌پر با لعاب فیروزه‌ای روی زمینهٔ کرم؛ برگرفته از نقوش مسجد و مدرسه در معماری ایرانی.',
    specs: { 'تکنیک': 'نقاشی دستی با لعاب', 'بافت سطح': 'مات مخملی', 'ضخامت': '۱۲ میلی‌متر', 'درجه تحمل رطوبت': 'بالا' },
    isNew: true,
    isBestSeller: true
  },
  {
    name: 'ترنج لاجورد',
    category: 'کاشی دیوار',
    patternName: 'ترنج',
    color: 'لاجوردی و نیلی',
    material: 'سرامیک لعاب‌دار',
    dimensions: '۴۰ × ۴۰ سانتی‌متر',
    usageArea: ['دیوار', 'سرسرا', 'نمای داخلی'],
    mainImage: IMG('semi-industrial-3.jpg'),
    galleryImages: [IMG('semi-industrial-3.jpg'), IMG('semi-industrial.jpg'), IMG('semi-industrial-9.jpg')],
    description: 'ترنج مرکزی با ظرافت نی‌نوشته؛ مرکزیت فضای ورودی را مشخص می‌کند.',
    specs: { 'تکنیک': 'نقاشی دستی با لعاب', 'بافت سطح': 'نیمه‌مات', 'ضخامت': '۱۱ میلی‌متر' },
    isNew: false,
    isBestSeller: true
  },
  {
    name: 'بته‌جقه قرمز',
    category: 'کاشی کف',
    patternName: 'بته‌جقه',
    color: 'قرمز لاکی و کرم',
    material: 'سفال دست‌ساز',
    dimensions: '۲۵ × ۲۵ سانتی‌متر',
    usageArea: ['کف', 'سالن ورودی', 'کتابخانه'],
    mainImage: IMG('semi-industrial-5.jpg'),
    galleryImages: [IMG('semi-industrial-5.jpg'), IMG('semi-industrial-1.jpg')],
    description: 'نقش بته‌جقهٔ سنتی در قرمز لاکی؛ مناسب کف فضاهای نشیمن و ورودی.',
    specs: { 'تکنیک': 'نقاشی دستی با لعاب', 'بافت سطح': 'مات', 'ضخامت': '۱۴ میلی‌متر', 'تحمل ساییدگی': 'عالی' },
    isNew: false,
    isBestSeller: false
  },
  {
    name: 'گل مینا',
    category: 'کاشی دیوار',
    patternName: 'گل مینا',
    color: 'مینایی سبز',
    material: 'سرامیک لعاب‌دار',
    dimensions: '۱۵ × ۱۵ سانتی‌متر',
    usageArea: ['دیوار پشت اجاق', 'حمام', 'سرویس بهداشتی'],
    mainImage: IMG('semi-industrial-1.jpg'),
    galleryImages: [IMG('semi-industrial-1.jpg'), IMG('semi-industrial-7.jpg')],
    description: 'گل‌های مینا روی زمینهٔ شیری؛ ایده‌آل برای کاشی‌کاری پشت اجاق در آشپزخانه‌های روشن.',
    specs: { 'تکنیک': 'نقاشی دستی با لعاب', 'بافت سطح': 'مات', 'ضخامت': '۱۰ میلی‌متر', 'درجه تحمل رطوبت': 'بالا' },
    isNew: true,
    isBestSeller: false
  },
  {
    name: 'چلیپای گلی',
    category: 'کاشی کف',
    patternName: 'چلیپا',
    color: 'سبز زیتونی و کرم',
    material: 'سفال دست‌ساز',
    dimensions: '۳۰ × ۳۰ سانتی‌متر',
    usageArea: ['کف', 'حیاط', 'تراس'],
    mainImage: IMG('semi-industrial-7.jpg'),
    galleryImages: [IMG('semi-industrial-7.jpg'), IMG('hero5.jpg')],
    description: 'چلیپای گلی در سبز زیتونی؛ مقاوم و مناسب کف و فضای باز.',
    specs: { 'تکنیک': 'نقاشی دستی با لعاب', 'بافت سطح': 'مات ضدلغزش', 'ضخامت': '۱۶ میلی‌متر', 'تحمل رطوبت': 'عالی' },
    isNew: false,
    isBestSeller: false
  },
  {
    name: 'ستارهٔ هشت‌پر',
    category: 'کاشی دیوار',
    patternName: 'ستاره',
    color: 'آبی پرفیروزه و سفید',
    material: 'سرامیک لعاب‌دار',
    dimensions: '۲۰ × ۲۰ سانتی‌متر',
    usageArea: ['دیوار', 'سرسرا', 'لابی'],
    mainImage: IMG('111111111.jpg'),
    galleryImages: [IMG('111111111.jpg'), IMG('industrial-1.jpg'), IMG('semi-industrial-2.jpg')],
    description: 'ستارهٔ هشت‌پر با ریزنقش‌های هندسی؛ یادآور کاشی‌کاری مساجد و آب‌انبارها.',
    specs: { 'تکنیک': 'نقاشی دستی با لعاب', 'بافت سطح': 'نیمه‌مات', 'ضخامت': '۱۱ میلی‌متر' },
    isNew: true,
    isBestSeller: true
  },
  {
    name: 'نگار نارنجی',
    category: 'کاشی دیوار',
    patternName: 'نگار',
    color: 'نارنجی سوخته و طلایی',
    material: 'سفال دست‌ساز',
    dimensions: '۱۵ × ۱۵ سانتی‌متر',
    usageArea: ['دیوار پشت اجاق', 'کافه', 'رستوران'],
    mainImage: IMG('hero.jpg'),
    galleryImages: [IMG('hero.jpg'), IMG('hero1.jpg')],
    description: 'نگارهای نارنجی سوخته با خطوط طلایی؛ برای فضاهای گرم و صمیمی.',
    specs: { 'تکنیک': 'نقاشی دستی با لعاب', 'بافت سطح': 'مات', 'ضخامت': '۱۰ میلی‌متر', 'درجه تحمل حرارت': 'بالا' },
    isNew: false,
    isBestSeller: false
  },
  {
    name: 'اشکی آبی',
    category: 'کاشی کف',
    patternName: 'اشکی',
    color: 'آبی کمرنگ و شیری',
    material: 'سرامیک لعاب‌دار',
    dimensions: '۲۰ × ۲۰ سانتی‌متر',
    usageArea: ['کف', 'حمام', 'رختکن'],
    mainImage: IMG('semi-industrial.jpg'),
    galleryImages: [IMG('semi-industrial.jpg'), IMG('semi-industrial-9.jpg')],
    description: 'نقش برگ‌اشکی در آبی کمرنگ؛ فضای حمام و استخر را لطیف می‌کند.',
    specs: { 'تکنیک': 'نقاشی دستی با لعاب', 'بافت سطح': 'مات ضدلغزش', 'ضخامت': '۱۲ میلی‌متر', 'درجه تحمل رطوبت': 'بالا' },
    isNew: false,
    isBestSeller: true
  },
  {
    name: 'گره‌گلی سبز',
    category: 'کاشی محوطه و فضای باز',
    patternName: 'گره',
    color: 'سبز جنگلی و مسی',
    material: 'سفال دست‌ساز',
    dimensions: '۲۵ × ۲۵ سانتی‌متر',
    usageArea: ['حیاط', 'تراس', 'پیاده‌رو'],
    mainImage: IMG('semi-industrial-6.jpg'),
    galleryImages: [IMG('semi-industrial-6.jpg'), IMG('hero2.jpg')],
    description: 'گره هندسی در سبز جنگلی با رشته‌های مسی؛ مقاوم در برابر شرایط جوی.',
    specs: { 'تکنیک': 'نقاشی دستی با لعاب', 'بافت سطح': 'مات ضدلغزش', 'ضخامت': '۱۸ میلی‌متر', 'تحمل یخ‌زدگی': 'عالی' },
    isNew: false,
    isBestSeller: false
  },
  {
    name: 'محرابی سفال',
    category: 'کاشی دیوار',
    patternName: 'محراب',
    color: 'سفال طبیعی و اکر',
    material: 'سفال دست‌ساز',
    dimensions: '۴۰ × ۶۰ سانتی‌متر',
    usageArea: ['دیوار', 'نمای داخلی', 'پیشخوان'],
    mainImage: IMG('industrial-1.jpg'),
    galleryImages: [IMG('industrial-1.jpg'), IMG('111111111.jpg')],
    description: 'کاشی محرابی با بافت سفال خام و لعاب اکر؛ نقطهٔ تاکید در نمای دیوار.',
    specs: { 'تکنیک': 'لعاب‌کاری سنتی', 'بافت سطح': 'شن‌دار', 'ضخامت': '۱۵ میلی‌متر' },
    isNew: false,
    isBestSeller: false
  },
  {
    name: 'خشت شمسهٔ کرم',
    category: 'کاشی محوطه و فضای باز',
    patternName: 'خشت شمسه',
    color: 'کرم و مشکی',
    material: 'سفال دست‌ساز',
    dimensions: '۲۵ × ۲۵ سانتی‌متر',
    usageArea: ['حیاط', 'استخر', 'حوضچه'],
    mainImage: IMG('industrial-3.jpg'),
    galleryImages: [IMG('industrial-3.jpg'), IMG('hero2.jpg')],
    description: 'خشت‌های شمسه در کرم و مشکی؛ ترکیب سنتی برای کف محوطه و لبهٔ استخر.',
    specs: { 'تکنیک': 'لعاب‌کاری سنتی', 'بافت سطح': 'مات ضدلغزش', 'ضخامت': '۱۶ میلی‌متر', 'تحمل یخ‌زدگی': 'عالی' },
    isNew: false,
    isBestSeller: false
  },
  {
    name: 'پنج‌ترنج طلایی',
    category: 'کاشی دیوار',
    patternName: 'ترنج پنج',
    color: 'مسی طلایی و کرم',
    material: 'سرامیک لعاب‌دار',
    dimensions: '۳۳ × ۳۳ سانتی‌متر',
    usageArea: ['دیوار', 'لابی', 'هتل'],
    mainImage: IMG('med.jpg'),
    galleryImages: [IMG('med.jpg'), IMG('hero5.jpg')],
    description: 'ترنج‌های پنج‌گانه در مسی طلایی؛ انتخاب لابی‌ها و فضاهای پذیرایی.',
    specs: { 'تکنیک': 'نقاشی دستی با لعاب', 'بافت سطح': 'نیمه‌مات', 'ضخامت': '۱۲ میلی‌متر' },
    isNew: true,
    isBestSeller: false
  }
];

// --- Projects ------------------------------------------------------------
const PROJECTS = [
  {
    title: 'دیوار پشت اجاقِ خانهٔ لواسان',
    categoryName: 'کاشی دیوار',
    location: 'لواسان، خانهٔ خصوصی',
    description: 'کاشی‌کاری شمسهٔ فیروزه و گل مینا روی دیوار پشت اجاق یک آشپزخانهٔ روشن؛ ترکیب دست‌ساز با مصالح مدرن برای یک نقطهٔ تاکید آرام.',
    coverImage: IMG('semi-industrial-4.jpg'),
    galleryImages: [IMG('semi-industrial-4.jpg'), IMG('semi-industrial-3.jpg'), IMG('111111111.jpg')]
  },
  {
    title: 'حمام سفید با کاشی اشکی',
    categoryName: 'کاشی کف',
    location: 'تهران، آپارتمان',
    description: 'کاشی اشکی آبی به همراه قرنیز سفال؛ محیط حمام را روشن‌تر و پیوسته‌تر کرده‌است.',
    coverImage: IMG('semi-industrial.jpg'),
    galleryImages: [IMG('semi-industrial.jpg'), IMG('semi-industrial-9.jpg')]
  },
  {
    title: 'حیاط سنتی یزد',
    categoryName: 'کاشی محوطه و فضای باز',
    location: 'یزد، خانهٔ تاریخی',
    description: 'چلیپای گلی و خشت شمسه در حیاط یک خانهٔ تاریخی؛ پیوند دوبارهٔ کاشی‌کاری سنتی با معماری کویری.',
    coverImage: IMG('semi-industrial-7.jpg'),
    galleryImages: [IMG('semi-industrial-7.jpg'), IMG('hero5.jpg'), IMG('hero2.jpg')]
  },
  {
    title: 'کافه و رستوران ارگ',
    categoryName: 'کاشی دیوار',
    location: 'ارگ کریم‌خان، شیراز',
    description: 'نگار نارنجی و ستارهٔ هشت‌پر در فضای کافه؛ گرما و اصالت ایرانی در یک مرکز پذیرایی مدرن.',
    coverImage: IMG('hero.jpg'),
    galleryImages: [IMG('hero.jpg'), IMG('hero1.jpg'), IMG('industrial-1.jpg')]
  }
];

const uniqueSlug = async (value, table) => {
  const base = slugify(value);
  let candidate = base;
  let suffix = 2;
  while (await prisma[table].findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
};

const main = async () => {
  console.log('Seeding demo tile data...');

  // 1. Clear test content
  await prisma.projectProduct.deleteMany();
  await prisma.project.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  console.log('Cleared existing products / categories / projects.');

  // 2. Categories
  const categoryIds = {};
  for (const cat of CATEGORIES) {
    const record = await prisma.category.create({
      data: {
        id: uuidv4(),
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        translations: {
          fa: { name: cat.translations.name.fa, description: cat.translations.description.fa },
          en: { name: cat.translations.name.en, description: cat.translations.description.en },
          ar: { name: cat.translations.name.ar, description: cat.translations.description.ar }
        }
      }
    });
    categoryIds[cat.name] = record.id;
  }
  console.log(`Created ${CATEGORIES.length} categories.`);

  // 3. Products
  for (const p of PRODUCTS) {
    const translations = {
      fa: {},
      en: {},
      ar: {
        name: p.name,
        description: p.description,
        patternName: null,
        color: null,
        material: null,
        dimensions: `20 × 20 سم`,
        usageArea: [],
        specs: {}
      }
    };
    await prisma.product.create({
      data: {
        id: uuidv4(),
        name: p.name,
        slug: await uniqueSlug(p.name, 'product'),
        categoryId: categoryIds[p.category],
        stock: 30,
        description: p.description,
        mainImage: p.mainImage,
        galleryImages: p.galleryImages,
        keywords: [p.name, p.patternName, p.material],
        isNew: p.isNew,
        isBestSeller: p.isBestSeller,
        specs: p.specs,
        patternName: p.patternName,
        color: p.color,
        material: p.material,
        dimensions: p.dimensions,
        usageArea: p.usageArea,
        translations
      }
    });
  }
  console.log(`Created ${PRODUCTS.length} products.`);

  // 4. Projects
  for (const proj of PROJECTS) {
    await prisma.project.create({
      data: {
        id: uuidv4(),
        title: proj.title,
        slug: await uniqueSlug(proj.title, 'project'),
        location: proj.location,
        description: proj.description,
        coverImage: proj.coverImage,
        galleryImages: proj.galleryImages,
        translations: {
          fa: { title: proj.title, location: proj.location, description: proj.description },
          en: { title: proj.title, location: proj.location, description: proj.description },
          ar: { title: proj.title, location: proj.location, description: proj.description }
        }
      }
    });
  }
  console.log(`Created ${PROJECTS.length} projects.`);

  console.log('Done.');
};

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());