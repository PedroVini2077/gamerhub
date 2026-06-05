import { useAuth } from './useAuth.jsx';

export function useRole() {
  const { profile } = useAuth();
  const role = profile?.role || 'user';

  return {
    role,
    isUser: true,
    isOwner:      role === 'owner',
    isAdmin:      role === 'admin' || role === 'super_admin' || role === 'owner',
    isSuperAdmin: role === 'super_admin' || role === 'owner',
    isBanned: profile?.banned || false,
  };
}
