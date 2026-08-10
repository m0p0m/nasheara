const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const viewsRoot = path.join(root, 'views');
const localePaths = Object.fromEntries(['fa', 'en', 'ar'].map(locale => [
    locale, path.join(root, 'locales', locale, 'common.json')
]));
const catalogs = Object.fromEntries(Object.entries(localePaths).map(([locale, file]) => [
    locale, JSON.parse(fs.readFileSync(file, 'utf8'))
]));
for (const catalog of Object.values(catalogs)) catalog.auto ||= {};

const letterPattern = /[\u0621-\u063A\u0641-\u064A\u066E-\u06D3\u06FA-\u06FF]/;
const phrasePattern = /[\u0621-\u063A\u0641-\u064A\u066E-\u06D3\u06FA-\u06FF][\u0600-\u06FF\u0750-\u077F\u200c\u200e\u200f\s0-9۰-۹A-Za-z.,،؛؟!…:()«»\-–—/+×]*/g;

const keyFor = text => `k_${crypto.createHash('sha1').update(text).digest('hex').slice(0, 12)}`;
const register = text => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const key = keyFor(normalized);
    catalogs.fa.auto[key] = normalized;
    catalogs.en.auto[key] ||= `[EN] ${normalized}`;
    catalogs.ar.auto[key] ||= `[AR] ${normalized}`;
    return `auto.${key}`;
};

const replaceHtmlLiterals = chunk => chunk.replace(phrasePattern, match => {
    const leading = match.match(/^\s*/)[0];
    const trailing = match.match(/\s*$/)[0];
    const text = match.trim();
    if (!letterPattern.test(text)) return match;
    return `${leading}<%= t('${register(text)}') %>${trailing}`;
});

const replaceEjsStringLiterals = token => token.replace(/(['"])([^'"\r\n]*[\u0621-\u063A\u0641-\u064A\u066E-\u06D3\u06FA-\u06FF][^'"\r\n]*)\1/g, (match, quote, text) => {
    if (!letterPattern.test(text)) return match;
    return `t('${register(text)}')`;
});

const viewFiles = fs.readdirSync(viewsRoot, { recursive: true }).filter(file => file.endsWith('.ejs'));
for (const relativePath of viewFiles) {
    const filePath = path.join(viewsRoot, relativePath);
    const source = fs.readFileSync(filePath, 'utf8');
    const parts = source.split(/(<%[\s\S]*?%>)/g);
    const translated = parts.map(part => part.startsWith('<%')
        ? replaceEjsStringLiterals(part)
        : replaceHtmlLiterals(part)).join('');
    fs.writeFileSync(filePath, translated);
}

for (const [locale, filePath] of Object.entries(localePaths)) {
    fs.writeFileSync(filePath, JSON.stringify(catalogs[locale], null, 2) + '\n');
}

console.log(`Extracted UI literals from ${viewFiles.length} EJS templates (${Object.keys(catalogs.fa.auto).length} auto keys).`);
