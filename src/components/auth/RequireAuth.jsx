import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';

// Bloqueia rotas internas para visitantes não-logados — redireciona pra "/",
// onde o guest cai na Landing (HomeOrLanding decide isso pelo estado de auth).
export default function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return children;
}
