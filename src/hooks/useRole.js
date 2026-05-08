import { useAuth } from './useAuth.jsx';

export function useRole() {
  const { profile } = useAuth();
  const role = profile?.role || 'user';

  return {
    role,
    isUser: true,
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    isBanned: profile?.banned || false,
  };
}
