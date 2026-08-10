const path = require('path');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');

const supportedLocales = ['fa', 'en', 'ar'];

i18next.use(Backend).use(middleware.LanguageDetector).init({
    fallbackLng: 'fa',
    supportedLngs: supportedLocales,
    preload: supportedLocales,
    initImmediate: false,
    ns: ['common'],
    defaultNS: 'common',
    backend: { loadPath: path.join(__dirname, '..', 'locales', '{{lng}}', '{{ns}}.json') },
    detection: { order: ['path'], lookupFromPathIndex: 0 },
    interpolation: { escapeValue: false },
    returnEmptyString: false
});

module.exports = { i18next, middleware, supportedLocales };
