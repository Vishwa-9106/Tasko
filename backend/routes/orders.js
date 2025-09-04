const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Create a new order (customer)
router.post('/', auth, async (req, res) => {
  try {
    const { customerInfo, items, total } = req.body;
    if (!customerInfo || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Invalid order payload' });
    }

    // Basic normalization
    const normalizedItems = items.map((it) => ({
      product: it.productId || it.product,
      name: it.name,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
    }));

    // Atomic stock reservation: decrement stock for each product if sufficient
    // To avoid overselling without requiring replica set transactions, we use conditional $inc with stock >= qty
    const decremented = []; // track successful decrements for rollback on failure
    try {
      for (const it of normalizedItems) {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const updated = await Product.findOneAndUpdate(
          { _id: it.product, stock: { $gte: qty } },
          { $inc: { stock: -qty } },
          { new: true }
        );
        if (!updated) {
          throw new Error(`Insufficient stock for product ${it.name || it.product}`);
        }
        decremented.push({ id: it.product, qty });
      }
    } catch (e) {
      // rollback any partial decrements
      await Promise.all(
        decremented.map(({ id, qty }) =>
          Product.updateOne({ _id: id }, { $inc: { stock: qty } })
        )
      );
      return res.status(400).json({ message: e.message || 'Insufficient stock for one or more items' });
    }

    const order = new Order({
      customer: req.userId,
      customerInfo: {
        name: customerInfo.name,
        address: customerInfo.address,
        phone: customerInfo.phone,
        paymentOption: customerInfo.paymentOption,
      },
      items: normalizedItems,
      total: Number(total) || normalizedItems.reduce((acc, i) => acc + i.price * i.quantity, 0),
      status: 'Pending',
    });

    let saved;
    try {
      saved = await order.save();
    } catch (saveErr) {
      // rollback stock if order save fails
      await Promise.all(
        (normalizedItems || []).map((it) =>
          Product.updateOne({ _id: it.product }, { $inc: { stock: Number(it.quantity) || 1 } })
        )
      );
      throw saveErr;
    }
    await saved.populate(['customer']);
    return res.json(saved);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// Get all orders (admin)
router.get('/', auth, requireRole('admin'), async (_req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// Update order status (admin)
router.put('/:id/status', auth, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Pending', 'Confirmed', 'Delivered', 'Cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Order not found' });
    res.json(updated);
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

// Get current user's orders (optional)
router.get('/mine', auth, async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error('List my orders error:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

module.exports = router;
