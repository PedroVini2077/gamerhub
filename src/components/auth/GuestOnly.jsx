import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';

// Evita que um usuário já logado veja a tela de login — manda direto pro feed.
export default function GuestOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return children;
}
