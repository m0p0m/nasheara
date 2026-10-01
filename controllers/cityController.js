const Product = require('../models/product');
const Project = require('../models/project');
const seo = require('../lib/seo');
const { CITIES, bySlug, projectsIn } = require('../lib/cities');

// City pages are written in Persian only; other languages are kept out of the
// index so they are not duplicates of the Persian text.
const cityIndexing = (siteUrl, path, locale) => ({
    noindex: locale !== 'fa',
    alternateUrls: seo.alternatesFor(siteUrl, path, ['fa'])
});

const cityFaq = city => [
    { q: `آیا به ${city} ارسال دارید؟`, a: `بله. سفارش‌ها از کارگاه نقش آرا در قم به ${city} و همهٔ شهرهای ایران ارسال می‌شود. هزینه و زمان ارسال پس از مشخص شدن سفارش اعلام می‌شود.` },
    { q: 'بدون مراجعهٔ حضوری چطور طرح و رنگ را انتخاب کنم؟', a: 'عکس فضا و ابعاد دیوار را برای کارشناسان نقش آرا بفرستید تا رایگان راهنمایی‌تان کنند. طرح‌ها را هم می‌توانید پیش از سفارش در شبیه‌ساز فضای سایت روی دیوار ببینید.' },
    { q: 'امکان سفارش رنگ یا ابعاد اختصاصی وجود دارد؟', a: 'برای بسیاری از طرح‌ها بله. رنگ لعاب، ابعاد و متراژ موردنظرتان را در فرم مشاوره بنویسید تا امکان‌پذیری و زمان تولید اعلام شود.' }
];

// GET /:locale/cities
const getCities = async (req, res) => {
    const siteUrl = seo.siteUrlFrom(req);
    res.render('public/cities', {
        title: 'ارسال کاشی دست‌ساز و بلوک سرامیکی به شهرهای ایران | نقش آرا',
        metaDescription: 'کاشی دست‌ساز و بلوک سرامیکی لعاب‌دار نقش آرا از کارگاه قم به همهٔ شهرهای ایران ارسال می‌شود؛ تهران، اصفهان، مشهد، شیراز، تبریز، کرج و دیگر شهرها.',
        canonicalUrl: `${siteUrl}/fa/cities`,
        ...cityIndexing(siteUrl, '/cities', req.locale),
        structuredData: [seo.breadcrumbList(siteUrl, [
            { name: 'خانه', path: '/fa/' },
            { name: 'شهرها', path: '/fa/cities' }
        ])],
        cities: CITIES,
        layout: 'public/layout',
        currentPath: req.path
    });
};

// GET /:locale/city/:slug
const getCity = async (req, res, next) => {
    try {
        const city = bySlug(req.params.slug);
        if (!city) return next();
        const [products, projects] = await Promise.all([Product.getAll('fa'), Project.getAll('fa')]);
        const siteUrl = seo.siteUrlFrom(req);
        const path = `/city/${encodeURIComponent(city.slug)}`;
        const faq = cityFaq(city.name);
        // a mix of tiles and blocks, newest first
        const showcase = products
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 8);
        res.render('public/city', {
            title: `کاشی دست‌ساز و بلوک سرامیکی در ${city.name} | نقش آرا`,
            metaDescription: seo.clip(`خرید کاشی دست‌ساز و بلوک سرامیکی لعاب‌دار نقش آرا در ${city.name}. ${city.intro.split('\n')[0]}`),
            canonicalUrl: `${siteUrl}/fa${path}`,
            ...cityIndexing(siteUrl, path, req.locale),
            structuredData: [
                seo.breadcrumbList(siteUrl, [
                    { name: 'خانه', path: '/fa/' },
                    { name: 'شهرها', path: '/fa/cities' },
                    { name: city.name, path: `/fa${path}` }
                ]),
                {
                    '@context': 'https://schema.org',
                    '@type': 'Service',
                    name: `کاشی دست‌ساز و بلوک سرامیکی لعاب‌دار در ${city.name}`,
                    serviceType: 'تولید و فروش کاشی دست‌ساز و بلوک سرامیکی لعاب‌دار',
                    areaServed: { '@type': 'City', name: city.name },
                    provider: { '@type': 'LocalBusiness', name: 'نقش آرا', url: siteUrl },
                    url: `${siteUrl}/fa${path}`
                },
                seo.faqSchema(faq),
                seo.productListItem(siteUrl, 'fa', showcase)
            ],
            city,
            cityProjects: projectsIn(city, projects),
            products: showcase,
            faq,
            otherCities: CITIES.filter(c => c.slug !== city.slug),
            layout: 'public/layout',
            currentPath: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('خطایی در بارگذاری صفحه رخ داد.');
    }
};

module.exports = { getCities, getCity, CITIES };
