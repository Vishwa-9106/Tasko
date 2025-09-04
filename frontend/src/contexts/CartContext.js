import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('cart_items', JSON.stringify(items));
  }, [items]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((v) => !v), []);

  const addToCart = useCallback((product, qty = 1) => {
    if (!product || !product._id) return;
    setItems((prev) => {
      const existing = prev.find((it) => it.productId === product._id);
      if (existing) {
        return prev.map((it) =>
          it.productId === product._id ? { ...it, quantity: it.quantity + qty } : it
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          price: Number(product.price) || 0,
          imageUrl: product.imageUrl || '',
          quantity: qty,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId, qty) => {
    setItems((prev) =>
      prev
        .map((it) => (it.productId === productId ? { ...it, quantity: Math.max(1, qty) } : it))
        .filter((it) => it.quantity > 0)
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const { count, total } = useMemo(() => {
    const count = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const total = items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    return { count, total };
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      isOpen,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      openCart,
      closeCart,
      toggleCart,
      count,
      total,
    }),
    [items, isOpen, addToCart, removeFromCart, updateQuantity, clearCart, openCart, closeCart, toggleCart, count, total]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
};
