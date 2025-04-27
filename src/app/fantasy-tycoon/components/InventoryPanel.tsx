"use client";
import { useState, useCallback } from "react";
import { Item } from "../models/item";
import Button from "../../components/ui/Button";
import List from "../../components/ui/List";

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
        <h2 className="text-xl font-bold mb-4 text-black">Inventory</h2>
        {error && <div className="text-red-500 mb-2">{error}</div>}
        {items.length === 0 ? (
          <div className="text-black">Your inventory is empty.</div>
        ) : (
          <List
            items={items}
            className="space-y-2"
            renderItem={(item) => (
              <div className="flex items-center space-x-2 rounded p-2 transition-all duration-200 hover:scale-[1.03]">
                <div className="flex-1">
                  <div className="font-bold text-black">{item.name}</div>
                  <div className="text-xs text-black">{item.description}</div>
                </div>
                <span className="font-mono px-2">x{item.quantity}</span>
                <Button
                  variant="primary"
                  className="text-xs mr-1 px-2 py-1"
                  onClick={() => handleUse(item)}
                  title="Use one of this item"
                >
                  Use
                </Button>
                <Button
                  variant="danger"
                  className="text-xs px-2 py-1"
                  onClick={() => handleDiscard(item)}
                  title="Discard all of this item"
                >
                  Discard
                </Button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
