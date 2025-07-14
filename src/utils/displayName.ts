import { User, Developer } from '@/types';

export function formatDisplayName(user: User | null, developer: Developer | null): string {
  if (!user) {
    return developer?.github_username || 'Unnamed Developer';
  }

  if (developer?.github_username) {
    return `${user.name.split(' ')[0]} (${developer.github_username})`;
  }

  return user.name;
}
