const fs = require('fs');
const path = require('path');

/**
 * Read JSON file safely. Returns parsed data or default.
 * @param {string} filePath
 * @param {any} defaultValue
 */
function readJSON(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read JSON:', filePath, err);
    return defaultValue;
  }
}

/**
 * Write JSON file atomically.
 * @param {string} filePath
 * @param {any} data
 */
function writeJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error('Failed to write JSON:', filePath, err);
  }
}

module.exports = { readJSON, writeJSON };
