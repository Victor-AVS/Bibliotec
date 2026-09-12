const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const wwwDir = path.join(__dirname, 'www');

// Make sure www directory exists
if (fs.existsSync(wwwDir)) {
    fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir, { recursive: true });

// Copy index.html and replace Jinja url_for templates
const templatePath = path.join(srcDir, 'templates', 'index.html');
let htmlContent = fs.readFileSync(templatePath, 'utf8');

htmlContent = htmlContent.replace(/\{\{\s*url_for\('static',\s*filename='([^']+)'\)\s*\}\}/g, 'static/$1');

fs.writeFileSync(path.join(wwwDir, 'index.html'), htmlContent, 'utf8');

// Copy static folder recursively
function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

copyDirSync(path.join(srcDir, 'static'), path.join(wwwDir, 'static'));

console.log('✅ Web assets compiled successfully into www directory!');
