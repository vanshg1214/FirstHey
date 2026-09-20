import fs from 'fs';
import path from 'path';

const searchPaths = [
  './src/app',
  './src/components'
];

const replacements = [
  // Backgrounds
  { regex: /bg-indigo-600/g, replace: 'bg-slate-900' },
  { regex: /bg-indigo-700/g, replace: 'bg-black' },
  { regex: /bg-indigo-500/g, replace: 'bg-slate-800' },
  { regex: /bg-indigo-100/g, replace: 'bg-slate-200' },
  { regex: /bg-indigo-50/g, replace: 'bg-slate-100' },
  
  // Text colors
  { regex: /text-indigo-600/g, replace: 'text-slate-900' },
  { regex: /text-indigo-500/g, replace: 'text-slate-800' },
  { regex: /text-indigo-400/g, replace: 'text-slate-600' },
  { regex: /text-indigo-300/g, replace: 'text-slate-500' },

  // Borders
  { regex: /border-indigo-600/g, replace: 'border-slate-900' },
  { regex: /border-indigo-500/g, replace: 'border-slate-800' },
  { regex: /border-indigo-200/g, replace: 'border-slate-300' },
  { regex: /border-indigo-100/g, replace: 'border-slate-200' },

  // Rings & Shadows
  { regex: /ring-indigo-600/g, replace: 'ring-slate-900' },
  { regex: /ring-indigo-500/g, replace: 'ring-slate-800' },
  { regex: /ring-indigo-100/g, replace: 'ring-slate-200' },
  { regex: /shadow-indigo-200/g, replace: 'shadow-slate-300' },
  
  // Opacity variations
  { regex: /bg-indigo-500\/10/g, replace: 'bg-slate-900/5' },
  { regex: /bg-indigo-500\/20/g, replace: 'bg-slate-900/10' },
  { regex: /border-indigo-500\/30/g, replace: 'border-slate-900/20' },
  { regex: /border-indigo-500\/10/g, replace: 'border-slate-900/10' },
  { regex: /bg-indigo-950\/10/g, replace: 'bg-white' },
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

console.log('Indigo theme conversion completed.');
