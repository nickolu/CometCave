'use client';
import { useState, useCallback } from 'react';
import { Item } from '../models/types';
import { Button } from '@/app/components/ui/buutton';
import { List } from '@/app/components/ui/liist';

interface InventoryPanelProps {
  inventory: Item[];
}

export function InventoryPanel({ inventory }: InventoryPanelProps) {
  const [error, setError] = useState<string | null>(null);

  // The following handlers should be lifted up to the parent if they need to update state
  // For now, they are left as stubs
  const handleUse = useCallback((item: Item) => {
    console.log('Item use not implemented in this component.', item);
    setError('Item use not implemented in this component.');
  }, []);

  const handleDiscard = useCallback((item: Item) => {
    console.log('Item discard not implemented in this component.', item);
    setError('Item discard not implemented in this component.');
  }, []);

  const items = inventory ?? [];

  return (
    <aside className="w-full bg-white p-4 flex flex-col h-full max-h-[calc(100vh-415px)] overflow-auto">
      <h2 className="text-xl font-bold mb-4 text-black">Inventory</h2>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {items.length === 0 ? (
        <div className="text-black">Your inventory is empty.</div>
      ) : (
        <List
          items={items}
          className="space-y-2 w-full"
          renderItem={item => (
            <div className="flex w-full items-center p-2 transition-all duration-200 hover:scale-[1.03]">
              <div className="flex-1">
                <div className="font-bold text-black">{item.name}</div>
                <div className="text-xs text-black">{item.description}</div>
              </div>
              <span className="font-mono px-2">x{item.quantity}</span>
              <Button
                variant="default"
                className="text-xs mr-1 px-2 py-1"
                onClick={() => handleUse(item)}
                title="Use one of this item"
              >
                Use
              </Button>
              <Button
                variant="destructive"
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
    </aside>
  );
}
