"use client";
import { useState, useCallback, useEffect } from "react";
import { Item } from "../models/item";
import { useGameState } from "../hooks/useGameState";
import { removeItem, updateQuantity } from "../lib/inventory";
import Image from "next/image";

interface InventoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InventoryPanel({ isOpen, onClose }: InventoryPanelProps) {
  const { gameState, save } = useGameState();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (gameState?.inventory) {
      setItems(gameState.inventory);
    }
  }, [gameState]);

  const handleUse = useCallback((item: Item) => {
    // Example: decrease quantity by 1
    if (!gameState) return;
    if (item.quantity > 1) {
      const updated = updateQuantity(gameState, item.id, item.quantity - 1);
      save(updated);
    } else {
      const updated = removeItem(gameState, item.id);
      save(updated);
    }
  }, [gameState, save]);

  const handleDiscard = useCallback((item: Item) => {
    if (!gameState) return;
    const updated = removeItem(gameState, item.id);
    save(updated);
  }, [gameState, save]);

  // Keyboard shortcut: I to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "i") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handler);
    }
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
        <button
          className="absolute top-2 right-2 text-gray-600 hover:text-gray-900"
          onClick={onClose}
          aria-label="Close inventory"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-4">Inventory</h2>
        {items.length === 0 ? (
          <div className="text-gray-500">Your inventory is empty.</div>
        ) : (
          <ul className="space-y-3 max-h-80 overflow-y-auto">
            {items.map(item => (
              <li key={item.id} className="flex items-center gap-3 border-b pb-2 last:border-b-0">
                <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded">
                  <Image src={item.icon} alt={item.name} width={24} height={24} className="w-6 h-6 object-contain" />
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
                <span className="font-mono px-2">x{item.quantity}</span>
                <button
                  className="bg-green-500 text-white px-2 py-1 rounded text-xs mr-1"
                  onClick={() => handleUse(item)}
                >
                  Use
                </button>
                <button
                  className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                  onClick={() => handleDiscard(item)}
                >
                  Discard
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
