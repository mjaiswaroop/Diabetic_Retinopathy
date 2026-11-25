export type UserRole = 'operator' | 'clinician' | 'admin' | 'researcher';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  siteId: string;
  siteName: string;
}

const STORAGE_KEY = 'xai_auth_user';

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}

export function getDefaultRouteForRole(role: UserRole, locale: string = 'en'): string {
  switch (role) {
    case 'operator':
      return `/${locale}/operator`;
    case 'clinician':
      return `/${locale}/review`;
    case 'admin':
    case 'researcher':
      return `/${locale}/dashboard`;
    default:
      return `/${locale}/login`;
  }
}

