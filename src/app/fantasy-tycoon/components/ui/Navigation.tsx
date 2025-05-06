"use client";

import Link from "next/link";

export const Navigation = ({ pageId }: { pageId: string }) => {
  const className = (id: string) => pageId === id ? "px-2 py-1 border rounded bg-blue-900" : "px-2 py-1 border rounded";
  return (
    <div className="flex space-x-2">
      <Link href="/fantasy-tycoon/characters" className={className("characters")}>
        Characters
      </Link>
      <Link href="/fantasy-tycoon/game" className={className("game")}>
        Game
      </Link>
    </div>
  );
};  