const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const User = require('../models/User');

const router = express.Router();

// Map human-readable category to constant name in categories.js
const CATEGORY_CONST_MAP = {
  'Home Cleaning': 'HOME_CLEANING_OPTIONS',
  'Dishwashing': 'DISHWASHING_OPTIONS',
  'Laundry': 'LAUNDRY_OPTIONS',
  'Cooking': 'COOKING_OPTIONS',
  'Cloud Kitchen': 'CLOUD_KITCHEN_OPTIONS',
  'Baby Sitting': 'BABYSITTING_OPTIONS',
  'Gardening': 'GARDENING_OPTIONS',
  'Maintenance': 'MAINTENANCE_OPTIONS',
};

const CATEGORIES_FILE = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'constants', 'categories.js');

function safeString(str) {
  return String(str).trim();
}

function upsertCategoriesArray(source, categoryName) {
  const regex = /export\s+const\s+CATEGORIES\s*=\s*\[(.*?)\]/s;
  const match = source.match(regex);
  if (!match) throw new Error('Could not find CATEGORIES in categories.js');
  const body = match[1];
  const present = new RegExp(`['"]${categoryName.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`)}['"]`).test(body);
  if (present) return source;
  const bodyWithComma = /,\s*$/.test(body) ? body : body.replace(/\s*$/, ',');
  const indentMatch = body.match(/\n(\s*)[^\n]*$/);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const insertion = `\n${indent}'${categoryName}',`;
  return source.replace(regex, `export const CATEGORIES = [${bodyWithComma}${insertion}\n];`);
}

function upsertIconMap(source, categoryName, iconIdentifier = 'Home') {
  const regex = /export\s+const\s+ICON_MAP\s*=\s*\{([\s\S]*?)\}/;
  const match = source.match(regex);
  if (!match) throw new Error('Could not find ICON_MAP in categories.js');
  const body = match[1];
  const keyPattern = new RegExp(`['\"]${categoryName.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`)}['\"]\s*:`);
  if (keyPattern.test(body)) return source;
  const indentMatch = body.match(/\n(\s*)[^\n]*$/);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const needsComma = /,\s*$/.test(body) || body.trim().length === 0;
  const prefix = needsComma ? '' : ',';
  const insertion = `${prefix}\n${indent}'${categoryName}': ${iconIdentifier}`;
  return source.replace(regex, `export const ICON_MAP = {${body}${insertion}\n};`);
}

function createOptionsConstBlock(constName, servicesArray) {
  const lines = servicesArray
    .map((s) => `  '${String(s).trim().replace(/'/g, "\\'")}',`)
    .join('\n');
  return `\n// Predefined options for Service Name when category is \"${constName.replace(/_OPTIONS$/, '').replace(/_/g, ' ')}\"\nexport const ${constName} = [\n${lines}\n];\n`;
}

function ensureOptionsConst(source, constName, servicesArray) {
  const regex = new RegExp(`export\\s+const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`);
  if (regex.test(source)) return source; // already exists
  // Append the new block to the end of the file
  return source + createOptionsConstBlock(constName, servicesArray);
}

function toConstName(categoryName) {
  return categoryName.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_OPTIONS';
}

// POST /api/categories
// Body: { name: string, services: string[] }
router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const name = safeString(req.body?.name || '');
    let services = Array.isArray(req.body?.services) ? req.body.services : [];
    services = services.map((s) => safeString(s)).filter(Boolean);

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    if (!fs.existsSync(CATEGORIES_FILE)) {
      return res.status(500).json({ message: 'categories.js file not found' });
    }

    const original = fs.readFileSync(CATEGORIES_FILE, 'utf8');

    // 1) Add to CATEGORIES
    let updated = upsertCategoriesArray(original, name);

    // 2) Add to ICON_MAP with a default icon (Home)
    updated = upsertIconMap(updated, name, 'Home');

    // 3) Add OPTIONS export if provided
    const constName = toConstName(name);
    if (services.length) {
      updated = ensureOptionsConst(updated, constName, services);
    }

    if (updated !== original) {
      fs.writeFileSync(CATEGORIES_FILE, updated, 'utf8');
    }

    return res.status(201).json({ message: 'Category added', category: { name, services } });
  } catch (err) {
    console.error('Add category error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/categories/:category/services
// Body: { oldName: string, newName: string }
router.put('/:category/services', auth, requireRole('admin'), async (req, res) => {
  try {
    const category = safeString(req.params.category);
    const oldName = safeString((req.body && req.body.oldName) || '');
    const newName = safeString((req.body && req.body.newName) || '');

    if (!category || !oldName || !newName) {
      return res.status(400).json({ message: 'Category, oldName and newName are required' });
    }

    const constName = CATEGORY_CONST_MAP[category] || toConstName(category);

    if (!fs.existsSync(CATEGORIES_FILE)) {
      return res.status(500).json({ message: 'categories.js file not found' });
    }

    const original = fs.readFileSync(CATEGORIES_FILE, 'utf8');

    // Check presence first
    const present = new RegExp(`['"]${oldName.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`)}['"]`, 's').test(original);
    if (!present) {
      return res.status(404).json({ message: 'Service not found in category', updated: false });
    }

    const updated = replaceInArraySource(original, constName, oldName, newName);

    if (updated === original) {
      return res.json({ message: 'No changes applied', updated: false });
    }

    fs.writeFileSync(CATEGORIES_FILE, updated, 'utf8');

    // Propagate rename across all workers' services in DB
    try {
      await User.updateMany(
        {
          userType: 'worker',
          'services.name': oldName,
          'services.category': category,
        },
        {
          $set: { 'services.$[elem].name': newName },
        },
        {
          arrayFilters: [
            { 'elem.name': oldName, 'elem.category': category },
          ],
        }
      );
    } catch (e) {
      console.error('DB propagate rename error:', e);
      // Do not fail the request if constants file update succeeded; include warning
      return res.json({ message: 'Service renamed (constants updated). DB propagation failed', updated: true, warning: e.message });
    }

    return res.json({ message: 'Service renamed', updated: true });
  } catch (err) {
    console.error('Rename category service error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

function removeFromArraySource(source, constName, item) {
  const regex = new RegExp(
    `export\\s+const\\s+${constName}\\s*=\\s*\\[(.*?)\\]`,
    's'
  );
  const match = source.match(regex);
  if (!match) {
    throw new Error(`Could not find constant ${constName} in categories.js`);
  }

  let arrayBody = match[1];
  // Build a regex that removes a line containing the item, including optional leading/trailing commas and whitespace
  const itemPattern = new RegExp(
    `(,?\s*\n\s*)?['"]${item.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`)}['"]\s*,?`,
    'g'
  );

  const newArrayBody = arrayBody.replace(itemPattern, (m) => {
    // Normalize to a single newline when removing
    return '\n';
  }).replace(/\n{2,}/g, '\n');

  // Cleanup any dangling commas before closing bracket
  const cleaned = newArrayBody
    .replace(/,\s*\n\s*\]/s, '\n]')
    .replace(/\[\s*,/s, '[');

  return source.replace(regex, `export const ${constName} = [${cleaned}\n];`);
}

function appendToArraySource(source, constName, item) {
  // Regex to find export const CONST = [ ... ]; capturing inside of array
  const regex = new RegExp(
    `export\\s+const\\s+${constName}\\s*=\\s*\\[(.*?)\\]`,
    's'
  );
  const match = source.match(regex);
  if (!match) {
    throw new Error(`Could not find constant ${constName} in categories.js`);
  }

  const arrayBody = match[1];
  // Check if already present (simple substring match within quotes)
  const already = new RegExp(
    `['\"]${item.replace(/[.*+?^${}()|[\\]\\\\]/g, r => `\\${r}`)}['\"]`,
    's'
  ).test(arrayBody);
  if (already) return source; // no changes

  // Determine indentation
  const indentMatch = arrayBody.match(/\n(\s*)[^\n]*$/);
  const indent = indentMatch ? indentMatch[1] : '  ';

  // Ensure the previous last element ends with a comma before appending
  const arrayBodyHasTrailingComma = /,\s*$/.test(arrayBody);
  const arrayBodyWithComma = arrayBodyHasTrailingComma
    ? arrayBody
    : arrayBody.replace(/\s*$/, ',');

  const insertion = `\n${indent}'${item}',`;
  const newArrayBody = arrayBodyWithComma + insertion;
  return source.replace(regex, `export const ${constName} = [${newArrayBody}\n];`);
}

function replaceInArraySource(source, constName, oldItem, newItem) {
  // Regex to find export const CONST = [ ... ]; capturing inside of array
  const regex = new RegExp(
    `export\\s+const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`,
    's'
  );
  const match = source.match(regex);
  if (!match) {
    throw new Error(`Could not find constant ${constName} in categories.js`);
  }

  const arrayBody = match[1];
  const quotedOld = new RegExp(
    `(['"])${oldItem.replace(/[.*+?^${}()|[\]\\]/g, (r) => `\\${r}`)}\\1`,
    'g'
  );

  if (!quotedOld.test(arrayBody)) {
    // old item not present; return original without change
    return source;
  }

  // Replace keeping original quote style
  const replacedBody = arrayBody.replace(quotedOld, (m, quote) => {
    const safeNew = String(newItem).trim().replace(new RegExp(quote, 'g'), `\\${quote}`);
    return `${quote}${safeNew}${quote}`;
  });

  return source.replace(regex, `export const ${constName} = [${replacedBody}\n];`);
}

// POST /api/categories/:category/services
// Body: { name: string }
router.post('/:category/services', auth, requireRole('admin'), async (req, res) => {
  try {
    const category = safeString(req.params.category);
    const name = safeString((req.body && req.body.name) || '');

    if (!category || !name) {
      return res.status(400).json({ message: 'Category and service name are required' });
    }

    const constName = CATEGORY_CONST_MAP[category] || toConstName(category);

    if (!fs.existsSync(CATEGORIES_FILE)) {
      return res.status(500).json({ message: 'categories.js file not found' });
    }

    const original = fs.readFileSync(CATEGORIES_FILE, 'utf8');
    const updated = appendToArraySource(original, constName, name);

    if (updated === original) {
      return res.json({ message: 'Service already exists', updated: false });
    }

    fs.writeFileSync(CATEGORIES_FILE, updated, 'utf8');
    return res.status(201).json({ message: 'Service added', updated: true });
  } catch (err) {
    console.error('Add category service error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/categories/:category/services
// Body: { name: string }
router.delete('/:category/services', auth, requireRole('admin'), async (req, res) => {
  try {
    const category = safeString(req.params.category);
    const name = safeString((req.body && req.body.name) || '');

    if (!category || !name) {
      return res.status(400).json({ message: 'Category and service name are required' });
    }

    const constName = CATEGORY_CONST_MAP[category];
    if (!constName) {
      return res.status(400).json({ message: `Unsupported category: ${category}` });
    }

    if (!fs.existsSync(CATEGORIES_FILE)) {
      return res.status(500).json({ message: 'categories.js file not found' });
    }

    const original = fs.readFileSync(CATEGORIES_FILE, 'utf8');

    // If item not present, no-op
    const present = new RegExp(`['"]${name.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`)}['"]`, 's').test(original);
    if (!present) {
      return res.json({ message: 'Service not found', updated: false });
    }

    const updated = removeFromArraySource(original, constName, name);
    fs.writeFileSync(CATEGORIES_FILE, updated, 'utf8');
    return res.json({ message: 'Service removed', updated: true });
  } catch (err) {
    console.error('Delete category service error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
