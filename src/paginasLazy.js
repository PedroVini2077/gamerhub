import { lazy } from 'react';

/**
 * As páginas carregadas sob demanda.
 *
 * ── Por que elas saíram do `App.jsx` ────────────────────────────────────────
 *
 * O `npm run fim` reprovou o `App.jsx` acima de 300 linhas em 02/09 — sujeira
 * que eu mesmo fiz ao acrescentar o som e o fundo por seção. A regra do §4 é
 * dividir ANTES de entregar, não anotar para depois.
 *
 * Esta lista é o corte mais óbvio: dezoito linhas que são só declaração, sem
 * nenhuma decisão dentro. Tirá-las não muda comportamento nenhum — o `lazy()`
 * continua sendo avaliado na importação do módulo, como antes.
 *
 * ── Landing e Home são exclusivas entre si ──────────────────────────────────
 *
 * Visitante × logado: deixar as duas no pacote inicial fazia todo mundo baixar
 * a que nunca ia ver.
 */
export const Landing     = lazy(() => import('./pages/Landing'));
export const Home        = lazy(() => import('./pages/Home'));
export const Sobre       = lazy(() => import('./pages/Sobre'));
export const Privacidade = lazy(() => import('./pages/Privacidade'));
export const Regras      = lazy(() => import('./pages/Regras'));
export const Contato     = lazy(() => import('./pages/Contato'));
export const Termos      = lazy(() => import('./pages/Termos'));
export const PostPage    = lazy(() => import('./pages/PostPage'));
export const MuralPage   = lazy(() => import('./pages/MuralPage'));
export const Community   = lazy(() => import('./pages/Community'));
export const Keys        = lazy(() => import('./pages/Keys'));
export const Profile     = lazy(() => import('./pages/Profile'));
export const Admin       = lazy(() => import('./pages/Admin'));
export const Settings    = lazy(() => import('./pages/Settings'));
export const UserProfile = lazy(() => import('./pages/UserProfile'));
export const Lives       = lazy(() => import('./pages/Lives'));
export const Ranks       = lazy(() => import('./pages/Ranks'));
export const Owner       = lazy(() => import('./pages/Owner'));
