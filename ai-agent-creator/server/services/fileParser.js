const fs = require('fs');
const path = require('path');

async function parseFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  switch (ext) {
    case '.txt':
    case '.md':
      return fs.readFileSync(filePath, 'utf-8');

    case '.json':
      return fs.readFileSync(filePath, 'utf-8');

    case '.csv': {
      const Papa = require('papaparse');
      const raw = fs.readFileSync(filePath, 'utf-8');
      const result = Papa.parse(raw, { header: true });
      return JSON.stringify(result.data, null, 2);
    }

    case '.pdf': {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    }

    case '.docx': {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.json', '.csv', '.pdf', '.docx'];

function isSupportedFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

module.exports = { parseFile, isSupportedFile, SUPPORTED_EXTENSIONS };
