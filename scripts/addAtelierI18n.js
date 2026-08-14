const fs = require('fs');
const path = require('path');

const ATELIER = {
  brandName: { fa: 'نقش آرا', en: 'nasheara', ar: 'نقش آرا' },
  brandTag: { fa: 'کاشی دست‌ساز', en: 'Handmade Tiles', ar: 'بلاط يدوي' },
  heroEyebrow: { fa: 'نقش آرا کاشی دست‌ساز', en: 'Handmade Tile Atelier', ar: 'أتيليه بلاط يدوي' },
  heroTitle: { fa: 'کاشی،', en: 'Tiles,', ar: 'البلاط،' },
  heroTitleAccent: { fa: 'ساخته‌شده با دست و آتش', en: 'shaped by hand and fire', ar: 'تشكّلت باليد والنار' },
  heroSub: {
    fa: 'بیش از سه دهه است که نقش‌های ایرانی را با لعاب و سفال زنده نگه داشته‌ایم؛ برای دیوارها، کف‌ها و فضاهایی که می‌خواهند شخصیت داشته باشند.',
    en: 'For three decades we have kept Persian patterns alive in glaze and clay — for walls, floors and spaces with character.',
    ar: 'على مدى ثلاثة عقود نُبقي النقوش الفارسية حيّة في الطلاء والطين — للجدران والأرضيات والمساحات ذات الطابع الخاص.'
  },
  heroCta: { fa: 'مشاهده مجموعه', en: 'View the Collection', ar: 'عرض المجموعة' },
  heroCta2: { fa: 'گفت‌وگو با نقش آرا', en: 'Talk to the Atelier', ar: 'تحدث مع الأتيليه' },
  scroll: { fa: 'به پایین بروید', en: 'Scroll', ar: 'مرر للأسفل' },
  swatchEyebrow: { fa: 'گشت‌وگذار در مجموعه', en: 'Wander the Collection', ar: 'تجوّل في المجموعة' },
  swatchTitle: { fa: 'شاید این یکی، آن یکی را صدا کند', en: 'One pattern calls to another', ar: 'قد يدعو نقشٌ آخر' },
  swatchLead: {
    fa: 'هر مربع را لمس کنید؛ عکس، نام و جنسِ هر طرح روی دیوار ظاهر می‌شود.',
    en: 'Touch a swatch — the tile, its name and material appear on the wall.',
    ar: 'المس كل مربع؛ لتظهر الصورة والاسم والخامة.'
  },
  swatchInstall: { fa: 'تصویر نصب‌شده به‌زودی', en: 'Installation photography coming soon', ar: 'صور التركيب قريباً' },
  fromCollection: { fa: 'از همین مجموعه', en: 'From this collection', ar: 'من هذه المجموعة' },
  featuredEyebrow: { fa: 'منتخب نقش آرا', en: 'The Edited Edit', ar: 'الاختيار المميز' },
  featuredTitle: { fa: 'هشت طرحی که همیشه به آن‌ها برمی‌گردیم', en: 'Eight patterns we keep returning to', ar: 'ثمانية نقوش نعود إليها دائمًا' },
  featuredLead: { fa: 'نقوشی که حکایت از دست، لعاب و کوره دارند.', en: 'Patterns that speak of hand, glaze and kiln.', ar: 'نقوش تحكي عن اليد والطلاء والفرن.' },
  viewAll: { fa: 'مشاهده همه طرح‌ها', en: 'View all patterns', ar: 'عرض كل النقوش' },
  collectionsEyebrow: { fa: 'دسته‌ها', en: 'Collections', ar: 'المجموعات' },
  collectionsTitle: { fa: 'از کف تا دیوار و محوطه', en: 'From floor to wall to courtyard', ar: 'من الأرضية إلى الجدار إلى الفناء' },
  moreInfo: { fa: 'بیشتر بدانید', en: 'Learn more', ar: 'اعرف المزيد' },
  casesEyebrow: { fa: 'نمونه‌کارها', en: 'Installed Work', ar: 'أعمال منفّذة' },
  casesTitle: { fa: 'جایی که کاشی‌ها زندگی می‌کنند', en: 'Where the tiles live', ar: 'حيث تعيش البلاطات' },
  casesLead: { fa: 'هر پروژه، روایت یک فضا است.', en: 'Every project is the story of a space.', ar: 'كل مشروع هو حكاية فضاء.' },
  viewCase: { fa: 'مشاهده پروژه', en: 'View project', ar: 'عرض المشروع' },
  allProjects: { fa: 'همه نمونه‌کارها', en: 'All projects', ar: 'جميع الأعمال' },
  studioEyebrow: { fa: 'نقش آرا', en: 'The Atelier', ar: 'الأتيليه' },
  studioTitle: { fa: 'دست‌ها، لعاب و آتش', en: 'Hands, glaze and fire', ar: 'الأيدي والطلاء والنار' },
  studioLead: {
    fa: 'هر کاشی با دست نقاشی و در کوره پخته می‌شود؛ هیچ دو قطعه‌ای شبیه هم نیستند و هیچ سطحی تکراری نمی‌شود.',
    en: 'Every tile is painted by hand and fired in a kiln; no two pieces are alike, no surface repeats.',
    ar: 'كل بلاطة تُرسم يدويًا وتُحرق في الفرن؛ لا تتشابه قطعتان ولا يتكرر سطح.'
  },
  studioLink: { fa: 'درباره نقش آرا', en: 'About the atelier', ar: 'عن الأتيليه' },
  testimonialsEyebrow: { fa: 'گفته‌ها', en: 'Kind Words', ar: 'آراء العملاء' },
  testimonialsTitle: { fa: 'آنچه مشتریان می‌گویند', en: 'What our clients say', ar: 'ماذا يقول عملاؤنا' },
  articlesTitle: { fa: 'از کارگاه', en: 'From the Workshop', ar: 'من الورشة' },
  articlesLead: { fa: 'یادداشت‌هایی درباره لعاب، نگهداری و انتخاب نقش.', en: 'Notes on glaze, care and choosing a pattern.', ar: 'ملاحظات حول الطلاء والعناية واختيار النقش.' },
  readMore: { fa: 'مطالعه', en: 'Read', ar: 'اقرأ' },
  contactTitle: { fa: 'با نقش آرا گفت‌وگو کنید', en: 'Talk to the atelier', ar: 'تحدث مع الأتيليه' },
  contactLead: { fa: 'برای یک پروژه، بازسازی یا انتخاب نقش، از ما مشاوره بگیرید.', en: 'For a project, a renovation or a pattern choice, ask us anything.', ar: 'لأي مشروع أو ترميم أو اختيار نقش، استشرنا.' },
  consultCta: { fa: 'درخواست مشاوره', en: 'Request a consultation', ar: 'اطلب استشارة' },
  phoneSupport: { fa: 'پشتیبانی تلفنی', en: 'Phone support', ar: 'دعم هاتفي' },
  footerAbout: {
    fa: 'نقش آرا کاشی دست‌ساز؛ نقش‌های ایرانی در سفال و لعاب، برای دیوارها و کف‌های امروز.',
    en: 'A handmade tile atelier keeping Persian patterns alive in clay and glaze for contemporary walls and floors.',
    ar: 'أتيليه بلاط يدوي يحافظ على النقوش الفارسية في الطين والطلاء للجدران والأرضيات المعاصرة.'
  },
  explore: { fa: 'کاوش', en: 'Explore', ar: 'استكشف' },
  atelierContact: { fa: 'تماس با نقش آرا', en: 'Contact', ar: 'تواصل' },
  followUs: { fa: 'ما را دنبال کنید', en: 'Follow us', ar: 'تابعونا' },
  newsletterTitle: { fa: 'از طرح‌های تازه با خبر شوید', en: 'New patterns, first', ar: 'أنماط جديدة أولاً' },
  newsletterSub: { fa: 'خبرنامه ماهانه — بدون مزاحمت.', en: 'A monthly letter. No noise.', ar: 'رسالة شهرية دون إزعاج.' },
  newsletterPlaceholder: { fa: 'ایمیل شما', en: 'Your email', ar: 'بريدك الإلكتروني' },
  subscribe: { fa: 'عضویت', en: 'Subscribe', ar: 'اشترك' },
  rights: { fa: 'نقش آرا کاشی — تمامی حقوق محفوظ است.', en: 'nasheara Tiles — all rights reserved.', ar: 'نقش آرا للبلاط — جميع الحقوق محفوظة.' },
  allPatterns: { fa: 'همه طرح‌ها', en: 'All patterns', ar: 'كل النقوش' },
  patternName: { fa: 'نام طرح', en: 'Pattern', ar: 'النقش' },
  color: { fa: 'رنگ', en: 'Colour', ar: 'اللون' },
  material: { fa: 'جنس', en: 'Material', ar: 'الخامة' },
  dimensions: { fa: 'ابعاد', en: 'Dimensions', ar: 'الأبعاد' },
  usageArea: { fa: 'محل استفاده', en: 'Best used', ar: 'أفضل استخدام' },
  specs: { fa: 'مشخصات', en: 'Specifications', ar: 'المواصفات' },
  gallery: { fa: 'گالری', en: 'Gallery', ar: 'المعرض' },
  newBadge: { fa: 'تازه', en: 'New', ar: 'جديد' },
  bestSeller: { fa: 'پرطرفدار', en: 'Best seller', ar: 'الأكثر مبيعًا' },
  requestConsultation: { fa: 'درخواست مشاوره', en: 'Request a consultation', ar: 'اطلب استشارة' },
  backToPatterns: { fa: 'بازگشت به همه طرح‌ها', en: 'Back to all patterns', ar: 'العودة إلى كل النقوش' },
  related: { fa: 'طرح‌های مرتبط', en: 'Related patterns', ar: 'نقوش ذات صلة' },
  searchPatterns: { fa: 'جستجو در طرح‌ها', en: 'Search patterns', ar: 'ابحث في النقوش' },
  search: { fa: 'جستجو', en: 'Search', ar: 'ابحث' },
  allCategories: { fa: 'همه دسته‌ها', en: 'All categories', ar: 'كل الفئات' },
  filtersActive: { fa: 'فیلتر فعال:', en: 'Active filter:', ar: 'فلتر نشط:' },
  clearFilters: { fa: 'حذف فیلتر', en: 'Clear filter', ar: 'مسح الفلتر' },
  categories: { fa: 'دسته‌ها', en: 'Categories', ar: 'الفئات' },
  home: { fa: 'خانه', en: 'Home', ar: 'الرئيسية' },
  emptyProducts: { fa: 'هنوز طرحی برای نمایش وجود ندارد.', en: 'No patterns yet.', ar: 'لا توجد نقوش بعد.' },
  emptyFiltered: { fa: 'چیزی با این فیلتر پیدا نشد.', en: 'Nothing matches this filter.', ar: 'لا شيء يطابق هذا الفلتر.' },
  backHome: { fa: 'بازگشت به خانه', en: 'Back home', ar: 'العودة للرئيسية' }
};

const files = {
  fa: path.join(__dirname, '..', 'locales', 'fa', 'common.json'),
  en: path.join(__dirname, '..', 'locales', 'en', 'common.json'),
  ar: path.join(__dirname, '..', 'locales', 'ar', 'common.json')
};

for (const locale of ['fa', 'en', 'ar']) {
  const data = JSON.parse(fs.readFileSync(files[locale], 'utf8'));
  data.atelier = {};
  for (const [key, value] of Object.entries(ATELIER)) {
    data.atelier[key] = value[locale];
  }
  fs.writeFileSync(files[locale], JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Updated ${locale}: atelier namespace with ${Object.keys(ATELIER).length} keys`);
}
