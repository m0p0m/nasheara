const SUPPORTED_LOCALES = ['fa', 'en', 'ar'];

const hasValue = value => value !== undefined
    && value !== null
    && value !== ''
    && (!Array.isArray(value) || value.length > 0)
    && (Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length > 0);

const buildTranslations = (input, fields, existing = {}) => {
    const incoming = input && typeof input.translations === 'object' ? input.translations : {};
    const translations = {};
    for (const locale of SUPPORTED_LOCALES) {
        translations[locale] = { ...(existing && existing[locale] ? existing[locale] : {}) };
        for (const field of fields) {
            if (incoming[locale] && Object.prototype.hasOwnProperty.call(incoming[locale], field)) {
                translations[locale][field] = incoming[locale][field];
            } else if (locale === 'fa' && Object.prototype.hasOwnProperty.call(input, field)) {
                translations.fa[field] = input[field];
            }
        }
    }
    return translations;
};

const localizeRecord = (record, fields, locale = 'fa') => {
    if (!record) return record;
    const translations = record.translations && typeof record.translations === 'object' ? record.translations : {};
    const localized = { ...record, translations };
    for (const field of fields) {
        const localizedValue = translations[locale] && translations[locale][field];
        const fallbackValue = translations.fa && translations.fa[field];
        localized[field] = hasValue(localizedValue)
            ? localizedValue
            : (hasValue(fallbackValue) ? fallbackValue : record[field]);
    }
    return localized;
};

module.exports = { SUPPORTED_LOCALES, buildTranslations, localizeRecord };
