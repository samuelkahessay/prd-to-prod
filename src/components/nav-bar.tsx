'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/simulator', label: 'Simulator' },
  { href: '/replay', label: 'Replay' },
  { href: '/forensics', label: 'Forensics' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 h-16 bg-gray-900 flex items-center px-6 border-b border-gray-800">
      <span className="text-lg font-semibold text-white mr-auto">Pipeline Observatory</span>
      <div className="flex gap-6">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`text-sm font-medium transition-colors ${
              pathname === href
                ? 'text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
