'use client';
import { useCallback } from 'react';
import { Item } from '../models/types';
import { Button } from '@/app/components/ui/buutton';
import { List } from '@/app/components/ui/liist';

interface InventoryPanelProps {
  inventory: Item[];
}

export function InventoryPanel({ inventory }: InventoryPanelProps) {
  const handleUse = useCallback((item: Item) => {
    console.log('Item use not implemented in this component.', item);
  }, []);

  const handleDiscard = useCallback((item: Item) => {
    console.log('Item discard not implemented in this component.', item);
  }, []);

  const items = inventory ?? [];

  return (
    <div className="w-full flex flex-col h-full max-h-[calc(100vh-415px)] overflow-auto">
      {items.length === 0 ? (
        <div className="text-gray-400">Your inventory is empty.</div>
      ) : (
        <List
          items={items}
          className="space-y-0 w-full"
          renderItem={(item: Item) => (
            <div className="bg-[#1e1f30] border border-[#3a3c56] p-4 rounded-lg space-y-2 mb-3 w-full">
              <div className="flex-1">
                <div className="font-bold text-white">{item.name}</div>
                <div className="text-xs text-gray-400">{item.description}</div>
              </div>
              <div className="flex space-x-2 mt-3">
                <Button
                  className="flex-1 bg-[#2a2b3f] border border-[#3a3c56] hover:bg-[#3a3c56] text-white text-xs py-2 px-3 rounded-md transition-colors"
                  onClick={() => handleUse(item)}
                  title="Use one of this item"
                >
                  Use
                </Button>
                <Button
                  className="flex-1 bg-red-700 hover:bg-red-800 text-white text-xs py-2 px-3 rounded-md transition-colors"
                  onClick={() => handleDiscard(item)}
                  title="Discard all of this item"
                >
                  Discard
                </Button>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
