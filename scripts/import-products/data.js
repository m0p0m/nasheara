// Product catalogue for the glazed ceramic block import: one product per design,
// colour variants as gallery images. Image indices refer to p00.webp … produced
// by prepare-images.py.

const CATEGORY = {
    name: 'بلوک سرامیکی لعاب‌دار',
    description: 'بلوک‌های سرامیکی لعاب‌دار نقش آرا؛ بلوک‌های دکوراتیو مشبک با لعاب براق در طرح‌های موج، چهارپر و هرمی، مناسب نمای ساختمان، پارتیشن و دیوار دکوراتیو داخلی و خارجی.'
};

// Specs are sent as "key: value" lines (the same format the admin textarea uses),
// so values must not contain commas — the parser splits on them.
const COMMON = {
    fa: {
        material: 'سرامیک لعاب‌دار (لعاب براق)',
        dimensions: '۲۰ × ۲۰ سانتی‌متر، ضخامت ۱۰ سانتی‌متر (تقریبی)',
        usageArea: 'نمای ساختمان، پارتیشن و دیوار جداکننده، دیوار دکوراتیو داخلی، حیاط و فضای باز، لابی و فضاهای تجاری',
        specs: [
            'جنس: سرامیک لعاب‌دار',
            'سطح: براق (لعاب شیشه‌ای)',
            'ابعاد: ۲۰×۲۰×۱۰ سانتی‌متر (تقریبی)',
            'مقاومت: ضد آب و مقاوم به UV و یخ‌زدگی',
            'کاربرد: داخلی و خارجی',
            'نصب: با ملات یا چسب کاشی'
        ].join('\n')
    },
    en: {
        material: 'Glazed ceramic (high-gloss glaze)',
        dimensions: '20 × 20 cm, 10 cm deep (approx.)',
        usageArea: 'Facades, partitions, interior feature walls, courtyards and outdoor areas, lobbies and commercial spaces',
        specs: [
            'Material: Glazed ceramic',
            'Finish: High-gloss glaze',
            'Size: 20×20×10 cm (approx.)',
            'Durability: Waterproof / UV and frost resistant',
            'Use: Indoor and outdoor',
            'Installation: Mortar or tile adhesive'
        ].join('\n')
    },
    ar: {
        material: 'سيراميك مزجّج (طلاء لامع)',
        dimensions: '٢٠ × ٢٠ سم، بسماكة ١٠ سم (تقريباً)',
        usageArea: 'الواجهات، الفواصل، الجدران الداخلية المميزة، الأفنية والمساحات الخارجية، الردهات والمساحات التجارية',
        specs: [
            'الخامة: سيراميك مزجّج',
            'السطح: طلاء لامع',
            'المقاس: ٢٠×٢٠×١٠ سم (تقريباً)',
            'المتانة: مقاوم للماء والأشعة فوق البنفسجية والصقيع',
            'الاستخدام: داخلي وخارجي',
            'التركيب: بالملاط أو لاصق البلاط'
        ].join('\n')
    }
};

const img = i => `p${String(i).padStart(2, '0')}.webp`;

// Cover image for the category card on the home page.
const CATEGORY_IMAGE = img(0);

const PRODUCTS = [
    {
        slug: 'ceramic-breeze-block-wave',
        main: 0,
        gallery: [1, 2, 4, 5, 6, 7, 8, 9, 11, 12],
        isBestSeller: true,
        translations: {
            fa: {
                name: 'بلوک سرامیکی لعاب‌دار طرح موج',
                patternName: 'طرح موج (پیچ‌وتاب)',
                color: 'نارنجی، مسی، سبز زمردی، سرمه‌ای، طلایی، مشکی، فیروزه‌ای، سبز زیتونی، قرمز، خردلی، سفید',
                description: 'بلوک سرامیکی لعاب‌دار طرح موج با چهار پره‌ی منحنی که حول یک روزنه‌ی مرکزی می‌چرخند و حس حرکت و پویایی به دیوار می‌دهند. لعاب براق سطح، نور را بازتاب می‌دهد و در چیدمان‌های تکرارشونده الگویی سه‌بعدی و چشم‌نواز می‌سازد. این بلوک مشبک برای نمای ساختمان، پارتیشن‌های نورگذر، دیوار سبز، لابی و فضاهای تجاری انتخابی مدرن و ماندگار است.\n\nبلوک موج نقش آرا در ۱۱ رنگ نارنجی، مسی، سبز زمردی، سرمه‌ای، طلایی، مشکی، فیروزه‌ای، سبز زیتونی، قرمز، خردلی و سفید تولید می‌شود و می‌توانید آن را تک‌رنگ یا در ترکیب چند رنگ سفارش دهید. لعاب یکدست و ضد آب آن در برابر نور خورشید و یخ‌زدگی مقاوم است و برای فضای داخلی و خارجی مناسب است.',
                metaTitle: 'بلوک سرامیکی طرح موج | بلوک لعاب‌دار دکوراتیو در ۱۱ رنگ – نقش آرا',
                metaDescription: 'خرید بلوک سرامیکی لعاب‌دار طرح موج در ۱۱ رنگ برای نما، پارتیشن و دیوار دکوراتیو. لعاب براق، ضد آب و مقاوم به UV. مشاوره و قیمت از نقش آرا.',
                keywords: 'بلوک سرامیکی, بلوک سرامیکی لعاب‌دار, بلوک سرامیکی طرح موج, بلوک مشبک, بلوک دکوراتیو, بلوک نما, بلوک سرامیکی رنگی, پارتیشن سرامیکی, نقش آرا',
                ...COMMON.fa
            },
            en: {
                name: 'Wave Glazed Ceramic Breeze Block',
                patternName: 'Wave (Pinwheel) pattern',
                color: 'Orange, Copper, Emerald Green, Navy, Gold, Black, Turquoise, Olive, Red, Mustard, White',
                description: 'Glazed ceramic breeze block in a Wave pattern: four curved blades spin around a central opening, giving the wall a sense of motion. The high-gloss glaze reflects light and creates a striking three-dimensional rhythm when laid in repeat. Ideal for building facades, light-filtering partitions, lobbies and commercial interiors.\n\nThe Naghsh Ara Wave block comes in 11 colours – orange, copper, emerald green, navy, gold, black, turquoise, olive, red, mustard and white – and can be ordered in a single colour or mixed. The uniform, waterproof glaze resists sunlight and frost, so it works indoors and outdoors.',
                metaTitle: 'Wave Ceramic Breeze Block | Glazed Decorative Block in 11 Colours – Naghsh Ara',
                metaDescription: 'Buy the Wave glazed ceramic breeze block in 11 colours for facades, partitions and feature walls. Glossy, waterproof, UV resistant. Quotes from Naghsh Ara.',
                keywords: 'ceramic block, glazed ceramic block, wave ceramic block, breeze block, decorative block, facade block, coloured ceramic block, ceramic partition, Naghsh Ara',
                ...COMMON.en
            },
            ar: {
                name: 'بلوك سيراميك مزجّج بنقش الموجة',
                patternName: 'نقش الموجة',
                color: 'برتقالي، نحاسي، أخضر زمردي، كحلي، ذهبي، أسود، فيروزي، زيتوني، أحمر، خردلي، أبيض',
                description: 'بلوك سيراميك مزجّج بنقش الموجة؛ أربع شفرات منحنية تدور حول فتحة مركزية لتمنح الجدار إحساساً بالحركة. الطلاء اللامع يعكس الضوء ويخلق إيقاعاً ثلاثي الأبعاد لافتاً عند التكرار. مثالي لواجهات المباني والفواصل المخرّمة والردهات والمساحات التجارية.\n\nيتوفر بلوك الموجة من نقش آرا بـ ١١ لوناً: برتقالي ونحاسي وأخضر زمردي وكحلي وذهبي وأسود وفيروزي وزيتوني وأحمر وخردلي وأبيض، ويمكن طلبه بلون واحد أو بمزيج من الألوان. الطلاء الموحّد المقاوم للماء يتحمّل الشمس والصقيع للاستخدام الداخلي والخارجي.',
                metaTitle: 'بلوك سيراميك بنقش الموجة | بلوك مزجّج للزينة بـ ١١ لوناً – نقش آرا',
                metaDescription: 'اشترِ بلوك السيراميك المزجّج بنقش الموجة بـ ١١ لوناً للواجهات والفواصل والجدران المميزة. طلاء لامع مقاوم للماء والأشعة فوق البنفسجية. استشارة وأسعار من نقش آرا.',
                keywords: 'بلوك سيراميك, بلوك سيراميك مزجّج, بلوك سيراميك نقش الموجة, بلوك مخرّم, بلوك زخرفي, بلوك واجهات, بلوك سيراميك ملوّن, فاصل سيراميك, نقش آرا',
                ...COMMON.ar
            }
        }
    },
    {
        slug: 'ceramic-breeze-block-four-petal',
        main: 14,
        gallery: [13, 15, 16, 17, 18, 21, 22],
        isBestSeller: true,
        translations: {
            fa: {
                name: 'بلوک سرامیکی لعاب‌دار طرح چهارپر',
                patternName: 'طرح چهارپر (گل)',
                color: 'سرمه‌ای، سبز زیتونی، خردلی، تراکوتا، فیروزه‌ای، نوک‌مدادی، قرمز، طلایی (مدل شبدری)',
                description: 'بلوک سرامیکی لعاب‌دار طرح چهارپر با چهار روزنه‌ی گلبرگی که در کنار هم نقش یک گل هندسی را می‌سازند. این طرح کلاسیک و الهام‌گرفته از هنر ایرانی، هم نور و هوا را عبور می‌دهد و هم حریم بصری ایجاد می‌کند. لعاب براق و رنگ یکدست آن برای نمای ساختمان، دیوار حیاط، پارتیشن و دکوراسیون داخلی مناسب است.\n\nبلوک چهارپر نقش آرا در رنگ‌های سرمه‌ای، سبز زیتونی، خردلی، تراکوتا، فیروزه‌ای، نوک‌مدادی و قرمز عرضه می‌شود؛ مدل شبدری طلایی با یک روزنه‌ی چهاربرگ یکپارچه نیز برای فضاهای لوکس در همین خانواده قرار دارد. لعاب ضد آب و مقاوم به UV آن استفاده در فضای باز را بدون تغییر رنگ ممکن می‌کند.',
                metaTitle: 'بلوک سرامیکی طرح چهارپر | بلوک لعاب‌دار گل‌دار برای نما و پارتیشن – نقش آرا',
                metaDescription: 'خرید بلوک سرامیکی لعاب‌دار طرح چهارپر (گل) در ۸ رنگ برای نما، دیوار حیاط و پارتیشن. لعاب براق، ضد آب و مقاوم به UV. مشاوره و قیمت از نقش آرا.',
                keywords: 'بلوک سرامیکی, بلوک سرامیکی لعاب‌دار, بلوک سرامیکی چهارپر, بلوک سرامیکی گل, بلوک مشبک, بلوک دکوراتیو, بلوک نما, بلوک شبدری, پارتیشن سرامیکی, نقش آرا',
                ...COMMON.fa
            },
            en: {
                name: 'Four-Petal Glazed Ceramic Breeze Block',
                patternName: 'Four-Petal (Flower) pattern',
                color: 'Navy, Olive, Mustard, Terracotta, Turquoise, Charcoal, Red, Gold (Clover variant)',
                description: 'Glazed ceramic breeze block in a Four-Petal pattern: four petal-shaped openings form a geometric flower. Inspired by Persian ornament, it lets light and air through while keeping visual privacy. The glossy, uniform glaze suits facades, garden walls, partitions and interior feature walls.\n\nThe Naghsh Ara Four-Petal block is available in navy, olive, mustard, terracotta, turquoise, charcoal and red; a gold Clover variant with a single four-leaf opening completes the family for premium interiors. The waterproof, UV-resistant glaze keeps its colour outdoors.',
                metaTitle: 'Four-Petal Ceramic Breeze Block | Glazed Flower Block for Facades – Naghsh Ara',
                metaDescription: 'Buy the Four-Petal (flower) glazed ceramic breeze block in 8 colours for facades, garden walls and partitions. Glossy, waterproof, UV resistant. Quotes from Naghsh Ara.',
                keywords: 'ceramic block, glazed ceramic block, four petal ceramic block, flower breeze block, decorative block, facade block, clover block, ceramic partition, Naghsh Ara',
                ...COMMON.en
            },
            ar: {
                name: 'بلوك سيراميك مزجّج بنقش الزهرة رباعية البتلات',
                patternName: 'نقش الزهرة رباعية البتلات',
                color: 'كحلي، زيتوني، خردلي، تيراكوتا، فيروزي، رمادي فحمي، أحمر، ذهبي (موديل البرسيم)',
                description: 'بلوك سيراميك مزجّج بنقش الزهرة رباعية البتلات؛ أربع فتحات على شكل بتلات تشكّل زهرة هندسية مستوحاة من الزخرفة الفارسية، تسمح بمرور الضوء والهواء مع الحفاظ على الخصوصية. مناسب للواجهات وجدران الحدائق والفواصل والجدران الداخلية.\n\nيتوفر بلوك رباعي البتلات من نقش آرا بألوان الكحلي والزيتوني والخردلي والتيراكوتا والفيروزي والرمادي الفحمي والأحمر، إضافة إلى موديل البرسيم الذهبي بفتحة رباعية الأوراق للمساحات الفاخرة. الطلاء المقاوم للماء والأشعة فوق البنفسجية يحافظ على لونه في الخارج.',
                metaTitle: 'بلوك سيراميك بنقش الزهرة رباعية البتلات | بلوك مزجّج للواجهات – نقش آرا',
                metaDescription: 'اشترِ بلوك السيراميك المزجّج بنقش الزهرة رباعية البتلات بـ ٨ ألوان للواجهات وجدران الحدائق والفواصل. طلاء لامع مقاوم للماء. استشارة وأسعار من نقش آرا.',
                keywords: 'بلوك سيراميك, بلوك سيراميك مزجّج, بلوك سيراميك رباعي البتلات, بلوك زهرة, بلوك مخرّم, بلوك زخرفي, بلوك واجهات, بلوك برسيم, فاصل سيراميك, نقش آرا',
                ...COMMON.ar
            }
        }
    },
    {
        slug: 'ceramic-breeze-block-pyramid',
        main: 23,
        gallery: [24, 25, 26, 27, 28, 29, 31, 32, 33],
        isNew: true,
        translations: {
            fa: {
                name: 'بلوک سرامیکی لعاب‌دار طرح هرمی',
                patternName: 'طرح هرمی (قاب)',
                color: 'سرمه‌ای، مشکی، سبز، آبی نفتی، کرم، نارنجی، قرمز، سبز زیتونی، فیروزه‌ای، طلایی',
                description: 'بلوک سرامیکی لعاب‌دار طرح هرمی با چهار وجه شیب‌دار که به یک روزنه‌ی مستطیلی در مرکز می‌رسند. بازی نور و سایه روی سطوح براق، به دیوار عمق و حجمی مینیمال و مدرن می‌بخشد. این بلوک برای نمای ساختمان‌های معاصر، دیوار پشت تلویزیون، پارتیشن اداری و دکوراسیون فروشگاه‌ها گزینه‌ای شاخص است.\n\nبلوک هرمی نقش آرا در ۱۰ رنگ سرمه‌ای، مشکی، سبز، آبی نفتی، کرم، نارنجی، قرمز، سبز زیتونی، فیروزه‌ای و طلایی تولید می‌شود. لعاب یکدست، ضد آب و مقاوم به UV و یخ‌زدگی آن، استفاده در فضای داخلی و خارجی را بدون نگرانی از تغییر رنگ ممکن می‌کند.',
                metaTitle: 'بلوک سرامیکی طرح هرمی | بلوک لعاب‌دار مدرن در ۱۰ رنگ – نقش آرا',
                metaDescription: 'خرید بلوک سرامیکی لعاب‌دار طرح هرمی در ۱۰ رنگ برای نمای مدرن، دیوار تی‌وی و پارتیشن اداری. لعاب براق، ضد آب و مقاوم به UV. مشاوره و قیمت از نقش آرا.',
                keywords: 'بلوک سرامیکی, بلوک سرامیکی لعاب‌دار, بلوک سرامیکی هرمی, بلوک سرامیکی مدرن, بلوک مشبک, بلوک دکوراتیو, بلوک نما, پارتیشن سرامیکی, دیوار پشت تلویزیون, نقش آرا',
                ...COMMON.fa
            },
            en: {
                name: 'Pyramid Glazed Ceramic Breeze Block',
                patternName: 'Pyramid (Frame) pattern',
                color: 'Navy, Black, Green, Petrol Blue, Cream, Orange, Red, Olive, Turquoise, Gold',
                description: 'Glazed ceramic breeze block in a Pyramid pattern: four sloping faces converge on a rectangular opening at the centre. Light and shadow play across the glossy surfaces, giving the wall a minimal, modern depth. A standout choice for contemporary facades, TV feature walls, office partitions and retail interiors.\n\nThe Naghsh Ara Pyramid block comes in 10 colours – navy, black, green, petrol blue, cream, orange, red, olive, turquoise and gold. Its uniform glaze is waterproof and resists UV and frost, so it can be used indoors and outdoors without fading.',
                metaTitle: 'Pyramid Ceramic Breeze Block | Modern Glazed Block in 10 Colours – Naghsh Ara',
                metaDescription: 'Buy the Pyramid glazed ceramic breeze block in 10 colours for modern facades, TV walls and office partitions. Glossy, waterproof, UV resistant. Quotes from Naghsh Ara.',
                keywords: 'ceramic block, glazed ceramic block, pyramid ceramic block, modern breeze block, decorative block, facade block, ceramic partition, TV feature wall, Naghsh Ara',
                ...COMMON.en
            },
            ar: {
                name: 'بلوك سيراميك مزجّج بالنقش الهرمي',
                patternName: 'النقش الهرمي',
                color: 'كحلي، أسود، أخضر، أزرق بترولي، كريمي، برتقالي، أحمر، زيتوني، فيروزي، ذهبي',
                description: 'بلوك سيراميك مزجّج بالنقش الهرمي؛ أربعة أوجه مائلة تلتقي عند فتحة مستطيلة في المركز. تلاعب الضوء والظل على الأسطح اللامعة يمنح الجدار عمقاً حديثاً وبسيطاً. خيار مميّز للواجهات المعاصرة وجدران التلفاز والفواصل المكتبية والمتاجر.\n\nيتوفر البلوك الهرمي من نقش آرا بـ ١٠ ألوان: كحلي وأسود وأخضر وأزرق بترولي وكريمي وبرتقالي وأحمر وزيتوني وفيروزي وذهبي. الطلاء الموحّد مقاوم للماء والأشعة فوق البنفسجية والصقيع للاستخدام الداخلي والخارجي دون بهتان.',
                metaTitle: 'بلوك سيراميك بالنقش الهرمي | بلوك مزجّج عصري بـ ١٠ ألوان – نقش آرا',
                metaDescription: 'اشترِ بلوك السيراميك المزجّج بالنقش الهرمي بـ ١٠ ألوان للواجهات العصرية وجدران التلفاز والفواصل المكتبية. طلاء لامع مقاوم للماء. استشارة وأسعار من نقش آرا.',
                keywords: 'بلوك سيراميك, بلوك سيراميك مزجّج, بلوك سيراميك هرمي, بلوك عصري, بلوك مخرّم, بلوك زخرفي, بلوك واجهات, فاصل سيراميك, جدار التلفاز, نقش آرا',
                ...COMMON.ar
            }
        }
    }
].map(p => ({
    stock: 100,
    isNew: false,
    isBestSeller: false,
    tileWidthCm: 20,
    tileHeightCm: 20,
    tileShape: 'square',
    ...p,
    mainImage: img(p.main),
    galleryImages: p.gallery.map(img)
}));

// Slugs created by the earlier per-colour import that must be removed.
const OBSOLETE_SLUG_PREFIX = 'ceramic-block-';

module.exports = { CATEGORY, CATEGORY_IMAGE, PRODUCTS, OBSOLETE_SLUG_PREFIX };
