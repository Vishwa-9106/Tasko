const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

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

// POST /api/categories/:category/services
// Body: { name: string }
router.post('/:category/services', auth, requireRole('admin'), async (req, res) => {
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
