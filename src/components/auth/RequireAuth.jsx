import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDbOffline } from '../../hooks/useDbOffline';

/**
 * Porteiro das rotas internas.
 *
 * Barra dois casos, e a saída é a mesma: mandar para `/`, onde o
 * `HomeOrLanding` decide o que mostrar.
 *
 * 1. **Visitante não logado** — o motivo original.
 * 2. **Banco fora do ar** `[01/09]` — toda rota interna é consulta pura; sem
 *    banco elas viram uma sucessão de erros sem explicação. Antes isso era
 *    resolvido substituindo o app INTEIRO por uma tela de aviso, o que também
 *    matava `/sobre` e `/login` — páginas que não precisam do banco. Barrar
 *    aqui atinge exatamente o que depende dele, e nada além.
 */
export default function RequireAuth({ children }) {
  const { user } = useAuth();
  const semBanco = useDbOffline();
  if (!user || semBanco) return <Navigate to="/" replace />;
  return children;
}
