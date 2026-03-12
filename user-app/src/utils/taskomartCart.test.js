// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addTaskoMartCartItem,
  clearTaskoMartCart,
  getTaskoMartCartCount,
  getTaskoMartCartSubtotal,
  onTaskoMartCartUpdated,
  readTaskoMartCart,
  removeTaskoMartCartItem,
  setTaskoMartCartItemQuantity
} from "./taskomartCart";

describe("taskomart cart utilities", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds products, increments quantity, and calculates totals", () => {
    addTaskoMartCartItem({ id: "soap", name: "Soap", price: 30 });
    addTaskoMartCartItem({ id: "soap", name: "Soap", price: 30 });
    addTaskoMartCartItem({ id: "tea", name: "Tea", price: 50 });

    expect(readTaskoMartCart()).toEqual([
      expect.objectContaining({ id: "soap", quantity: 2, price: 30 }),
      expect.objectContaining({ id: "tea", quantity: 1, price: 50 })
    ]);
    expect(getTaskoMartCartCount()).toBe(3);
    expect(getTaskoMartCartSubtotal()).toBe(110);
  });

  it("updates quantities and removes items when quantity reaches zero", () => {
    addTaskoMartCartItem({ id: "soap", name: "Soap", price: 30 });
    setTaskoMartCartItemQuantity("soap", 4);
    removeTaskoMartCartItem("soap");

    expect(readTaskoMartCart()).toEqual([]);
  });

  it("notifies listeners when cart content changes", () => {
    const listener = vi.fn();
    const unsubscribe = onTaskoMartCartUpdated(listener);

    addTaskoMartCartItem({ id: "soap", name: "Soap", price: 30 });
    clearTaskoMartCart();

    expect(listener).toHaveBeenNthCalledWith(1, 1);
    expect(listener).toHaveBeenNthCalledWith(2, 0);

    unsubscribe();
  });
});
