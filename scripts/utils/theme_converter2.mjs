import fs from 'fs';
import path from 'path';

const searchPaths = [
  './src/app',
  './src/components'
];

const replacements = [
  // Primary brand background
  { regex: /bg-slate-900/g, replace: 'bg-blue-600' },
  { regex: /bg-slate-900\/5/g, replace: 'bg-blue-600/5' },
  { regex: /bg-slate-900\/10/g, replace: 'bg-blue-600/10' },
  { regex: /bg-slate-900\/20/g, replace: 'bg-blue-600/20' },
  // Let's not blindly replace bg-black, maybe just leave hover states to hover:bg-blue-700
  { regex: /hover:bg-black/g, replace: 'hover:bg-blue-700' },
  { regex: /hover:bg-slate-900/g, replace: 'hover:bg-blue-700' },
  
  // Primary brand borders
  { regex: /border-slate-900/g, replace: 'border-blue-600' },
  { regex: /border-slate-800/g, replace: 'border-blue-500' },
  { regex: /border-slate-900\/20/g, replace: 'border-blue-600/20' },
  { regex: /border-slate-900\/10/g, replace: 'border-blue-600/10' },

  // Rings
  { regex: /ring-slate-900/g, replace: 'ring-blue-600' },
  { regex: /ring-slate-800/g, replace: 'ring-blue-500' },

  // For text, we can't replace text-slate-900 blindly because it's the main text color.
  // But we can replace text-indigo-something if any are left, or specifically text-slate-900 when combined with hover
  // Let's just fix the buttons and accents first.
];

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;

      for (const { regex, replace } of replacements) {
        content = content.replace(regex, replace);
      }

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

searchPaths.forEach(p => {
  const absolutePath = path.resolve(p);
  if (fs.existsSync(absolutePath)) {
    processDirectory(absolutePath);
  }
});

console.log('Blue theme conversion completed.');
