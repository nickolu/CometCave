"use client";
import { useState, useCallback } from "react";
import { Item } from "../models/item";

interface InventoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Item[];
}

export default function InventoryPanel({ isOpen, onClose, inventory }: InventoryPanelProps) {
  const [error, setError] = useState<string | null>(null);

  // The following handlers should be lifted up to the parent if they need to update state
  // For now, they are left as stubs
  const handleUse = useCallback((item: Item) => {
    console.log("Item use not implemented in this component.", item);
    setError("Item use not implemented in this component.");
  }, []);

  const handleDiscard = useCallback((item: Item) => {
    console.log("Item discard not implemented in this component.", item);
    setError("Item discard not implemented in this component.");
  }, []);

  const items = inventory ?? [];

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
