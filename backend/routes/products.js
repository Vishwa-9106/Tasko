const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { uploadProductImage } = require('../middleware/uploadProduct');

// List products (public)
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// Create product (admin)
router.post('/', auth, requireRole('admin'), (req, res) => {
  uploadProductImage(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    try {
      const { name, description = '', price, stock, category } = req.body;
      if (!name || price === undefined || stock === undefined || !category) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : '';
      const product = new Product({
        name: name.trim(),
        description: (description || '').trim(),
        price: Number(price),
        stock: Number(stock),
        category: category.trim(),
        imageUrl,
      });
      const saved = await product.save();
      res.status(201).json(saved);
    } catch (e) {
      console.error('Create product error:', e);
      res.status(500).json({ message: 'Failed to create product' });
    }
  });
});

// Update product (admin)
router.put('/:id', auth, requireRole('admin'), (req, res) => {
  uploadProductImage(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    try {
      const { id } = req.params;
      const { name, description, price, stock, category, isActive } = req.body;
      const update = {};
      if (name !== undefined) update.name = name.trim();
      if (description !== undefined) update.description = description;
      if (price !== undefined) update.price = Number(price);
      if (stock !== undefined) update.stock = Number(stock);
      if (category !== undefined) update.category = category.trim();
      if (isActive !== undefined) update.isActive = isActive === 'true' || isActive === true;
      if (req.file) update.imageUrl = `/uploads/products/${req.file.filename}`;

      const updated = await Product.findByIdAndUpdate(id, update, { new: true });
      if (!updated) return res.status(404).json({ message: 'Product not found' });
      res.json(updated);
    } catch (e) {
      console.error('Update product error:', e);
      res.status(500).json({ message: 'Failed to update product' });
    }
  });
});

// Delete product (admin)
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (e) {
    console.error('Delete product error:', e);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

module.exports = router;
