import Link from "next/link";

export function Navigation() {
  return (
    <nav className="flex justify-center">
      <ul className="flex justify-center gap-4">
        <li><Link href="/">Home</Link></li>
        <li><Link href="/ring-toss">Ring Toss</Link></li>
      </ul>
    </nav>
  );
}