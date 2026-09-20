const sharp = require('sharp');
const fs = require('fs');

const inputPath = 'C:\\Users\\Sujal\\.gemini\\antigravity-ide\\brain\\1b578e5a-1f44-45b9-bda4-9818d8aed047\\ax_monogram_exact_1786956851745.png';
const outputPath = './public/ax_icon.png';

sharp(inputPath)
  .trim({ threshold: 220 }) 
  .toFile(outputPath)
  .then(info => {
    console.log('AX Exact Icon cropped successfully:', info);
  })
  .catch(err => console.error(err));
