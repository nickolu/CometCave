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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gameState?.inventory) {
      setItems(gameState.inventory);
    }
  }, [gameState]);

  const handleUse = useCallback((item: Item) => {
    setError(null);
    try {
      if (!gameState) return;
      if (item.quantity > 1) {
        const updated = updateQuantity(gameState, item.id, item.quantity - 1);
        save(updated);
      } else {
        const updated = removeItem(gameState, item.id);
        save(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [gameState, save]);

  const handleDiscard = useCallback((item: Item) => {
    setError(null);
    try {
      if (!gameState) return;
      const updated = removeItem(gameState, item.id);
      save(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
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
        {error && <div className="text-red-500 mb-2">{error}</div>}
        {items.length === 0 ? (
          <div className="text-gray-500">Your inventory is empty.</div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center space-x-2 bg-white/10 rounded p-2 transition-all duration-200 hover:scale-[1.03] hover:bg-white/20">
                <Image src={item.icon} alt={item.name} width={32} height={32} className="rounded" />
                <div className="flex-1">
                  <div className="font-bold text-white">{item.name}</div>
                  <div className="text-xs text-gray-300">{item.description}</div>
                </div>
                <span className="font-mono px-2">x{item.quantity}</span>
                <button
                  className="bg-green-500 text-white px-2 py-1 rounded text-xs mr-1 hover:bg-green-600 transition-colors duration-150"
                  onClick={() => handleUse(item)}
                  title="Use one of this item"
                >
                  Use
                </button>
                <button
                  className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors duration-150"
                  onClick={() => handleDiscard(item)}
                  title="Discard all of this item"
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
