import { User, Developer } from '@/types';

export function formatDisplayName(user: User | null, developer: Developer | null): string {
  if (!user) {
    return developer?.github_handle || 'Unnamed Developer';
  }

  if (developer?.github_handle) {
    return `${user.name.split(' ')[0]} (${developer.github_handle})`;
  }

  return user.name;
}
