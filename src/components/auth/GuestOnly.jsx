import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useDbOffline } from '../../hooks/useDbOffline';

/**
 * Evita que um usuário já logado veja a tela de login — manda direto pro feed.
 *
 * ── `[03/09]` Por que ele também precisa saber do banco ─────────────────────
 *
 * Sem esta segunda condição, o site prendia quem tinha sessão salva num laço
 * SEM SAÍDA quando o banco caía. O dono relatou com o projeto pausado:
 * *"ainda não consigo entrar na área de login e cadastro"*.
 *
 * O mecanismo, reproduzido com controle: `supabase.auth.getSession()` lê a
 * sessão do `localStorage` **sem tocar na rede**, então `user` fica preenchido
 * mesmo com o projeto pausado. Daí:
 *
 *     clica em "Entrar" -> /login -> GuestOnly vê `user` -> manda para /
 *     em / o HomeOrLanding vê `semBanco` -> mostra a landing
 *     a landing oferece "Entrar" ------------------------> volta ao começo
 *
 * Do lado de quem usa isso é indistinguível de "o site recarregou sozinho".
 *
 * ── A regra que os TRÊS portões agora compartilham ──────────────────────────
 *
 *     HomeOrLanding ... user && !semBanco -> área logada
 *     RequireAuth ..... !user || semBanco -> manda para /
 *     GuestOnly ....... user && !semBanco -> manda para /   <- era só `user`
 *
 * Uma frase: **sem banco, o site trata todo mundo como visitante.** Faz
 * sentido porque uma sessão que não pode ser conferida, e que não abre nenhuma
 * página interna, não é um login utilizável — é um dado velho no navegador.
 *
 * ── O que NÃO mudou, e é o risco que estava declarado ───────────────────────
 *
 * Com o banco de pé, quem está logado continua sendo mandado embora desta tela.
 * A condição é `user && !semBanco`, nunca só `semBanco`.
 */
export default function GuestOnly({ children }) {
  const { user } = useAuth();
  const semBanco = useDbOffline();
  if (user && !semBanco) return <Navigate to="/" replace />;
  return children;
}
