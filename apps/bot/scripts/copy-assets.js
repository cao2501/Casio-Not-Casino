const fs = require('fs');
const path = require('path');

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      const curTarget = path.join(target, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, curTarget);
      } else {
        fs.copyFileSync(curSource, curTarget);
      }
    });
  }
}

// Copy dashboard public assets
const srcPath = path.join(__dirname, '../src/modules/dashboard/public');
const destPath = path.join(__dirname, '../dist/modules/dashboard/public');

if (fs.existsSync(srcPath)) {
  copyFolderRecursiveSync(srcPath, destPath);
  console.log('✅ Static assets copied successfully!');
} else {
  console.error('❌ Source public path not found:', srcPath);
}
