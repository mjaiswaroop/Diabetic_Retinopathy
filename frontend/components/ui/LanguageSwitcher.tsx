'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { locales, Locale } from '@/lib/i18n';
import { Globe } from 'lucide-react';

const LANGUAGE_LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  kn: 'ಕನ್ನಡ'
};

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: string) => {
    // Replace current locale segment in pathname
    const segments = pathname.split('/');
    segments[1] = newLocale;
    const newPath = segments.join('/');
    router.push(newPath);
  };

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Globe className="w-4 h-4 text-slate-500" />
      <select
        value={currentLocale}
        onChange={(e) => handleLanguageChange(e.target.value)}
        aria-label="Select Application Language"
        className="bg-transparent border border-slate-300 rounded-md py-1.5 px-2 text-sm font-medium focus:ring-2 focus:ring-teal-600 focus:outline-none min-h-[44px]"
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {LANGUAGE_LABELS[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}

