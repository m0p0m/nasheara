const fs = require('fs');
const path = require('path');

const viewsDirectory = path.join(__dirname, '..', 'views', 'public');
for (const name of fs.readdirSync(viewsDirectory).filter(file => file.endsWith('.ejs'))) {
    const filePath = path.join(viewsDirectory, name);
    const current = fs.readFileSync(filePath, 'utf8');
    const updated = current
        .replace(/<a href="\/(?!<%= locale %>\/)/g, '<a href="/<%= locale %>/')
        .replace(/<form action="\/(?!<%= locale %>\/)/g, '<form action="/<%= locale %>/');
    if (updated !== current) fs.writeFileSync(filePath, updated);
}
