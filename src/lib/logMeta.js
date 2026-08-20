// Metadados dos logs de auditoria — fonte única para os dois painéis
// (`admin/LogsPanel` e `owner/LogsTab`), que antes mantinham listas próprias
// e desencontradas: o filtro de categoria não oferecia `profile`/`live`/
// `system` (logs dessas categorias existiam mas eram invisíveis no filtro) e o
// mapa de ícones cobria ~20 actions a menos do que o site realmente grava.
//
// Ao criar um `logAudit(...)` novo, ou uma função no banco que escreva em
// `admin_logs`, registrar a action aqui.

import {
  LogIn, LogOut, UserPlus, Ban, ShieldOff, LockOpen, KeyRound, ShieldAlert,
  FileText, Trash2, Pencil, MessageSquare, MessagesSquare,
  Tv, Radio, MicOff, Mic, RotateCcw, CheckCircle, XCircle,
  Crown, Shield, UserCog, Image, Mail, UserMinus, Clock, ScrollText,
  Lock, Settings2, Wrench, Siren, Bell, SlidersHorizontal, Filter, EyeOff, Eye,
} from 'lucide-react';

// ─── Categorias ──────────────────────────────────────────────────────────────
// `id` casa com a coluna `admin_logs.category`.
export const LOG_CATEGORIES = [
  { id: 'auth',     label: 'Auth',      Icon: Lock,      color: '#22c55e' },
  { id: 'security', label: 'Segurança', Icon: Shield,    color: '#ef4444' },
  { id: 'content',  label: 'Conteúdo',  Icon: FileText,  color: '#60a5fa' },
  { id: 'live',     label: 'Lives',     Icon: Tv,        color: '#f43f5e' },
  { id: 'profile',  label: 'Perfil',    Icon: UserCog,   color: '#a855f7' },
  { id: 'admin',    label: 'Admin',     Icon: Settings2, color: '#f97316' },
  { id: 'system',   label: 'Sistema',   Icon: Wrench,    color: '#6b7280' },
];

export const CATEGORY_META = Object.fromEntries(
  LOG_CATEGORIES.map(({ id, ...rest }) => [id, rest]),
);

export const DEFAULT_CATEGORY_META = { label: '—', Icon: FileText, color: '#6b7280' };

// ─── Severidade ──────────────────────────────────────────────────────────────
export const SEVERITY_COLOR = { info: '#6b7280', warning: '#f59e0b', critical: '#ef4444' };

// ─── Actions ─────────────────────────────────────────────────────────────────
// `cls` é a classe Tailwind usada pelo painel admin; `color` é o hex usado pelo
// painel do dono. Mantidos juntos pra não divergirem de novo.
const A = (Icon, cls, color) => ({ Icon, cls, color });

export const ACTION_META = {
  // auth — cliente
  auth_login_success:        A(LogIn,        'text-neon-green',  '#39ff14'),
  auth_logout:               A(LogOut,       'text-gray-400',    '#9ca3af'),
  // auth — banco
  auth_register:             A(UserPlus,     'text-neon-cyan',   '#22d3ee'),
  auth_banned_attempt:       A(Ban,          'text-red-400',     '#f87171'),

  // segurança — conta
  auth_password_changed:     A(KeyRound,     'text-yellow-400',  '#facc15'),
  auth_email_change_requested: A(Mail,       'text-yellow-400',  '#facc15'),
  auth_account_deleted:      A(UserMinus,    'text-red-400',     '#f87171'),
  admin_unlock_login:        A(LockOpen,     'text-neon-green',  '#39ff14'),

  // segurança — moderação de contas
  admin_ban:                 A(Ban,          'text-red-400',     '#f87171'),
  admin_unban:               A(Shield,       'text-neon-green',  '#39ff14'),
  admin_unban_requested:     A(RotateCcw,    'text-yellow-400',  '#facc15'),
  admin_unban_approved:      A(CheckCircle,  'text-neon-green',  '#39ff14'),
  admin_unban_denied:        A(XCircle,      'text-red-400',     '#f87171'),
  user_suspended:            A(Clock,        'text-yellow-400',  '#facc15'),
  auto_suspend:              A(ShieldAlert,  'text-yellow-400',  '#facc15'),
  auto_ban:                  A(ShieldOff,    'text-red-500',     '#ef4444'),

  // admin
  admin_role_changed:        A(Crown,        'text-yellow-400',  '#facc15'),
  set_role:                  A(Crown,        'text-yellow-400',  '#facc15'),
  admin_add_key:             A(KeyRound,     'text-neon-purple', '#bf00ff'),
  site_config_changed:       A(SlidersHorizontal, 'text-orange-400', '#f97316'),
  wordlist_added:            A(Filter,       'text-neon-purple', '#bf00ff'),
  wordlist_removed:          A(Filter,       'text-gray-400',    '#9ca3af'),
  moderation_approved:       A(EyeOff,       'text-orange-400',  '#f97316'),
  moderation_rejected:       A(Eye,          'text-neon-green',  '#39ff14'),

  // conteúdo — posts (o trigger `log_post_event` grava os `content_*`)
  content_post_created:      A(FileText,     'text-neon-green',  '#39ff14'),
  content_post_edited:       A(Pencil,       'text-gray-400',    '#9ca3af'),
  content_post_deleted:      A(Trash2,       'text-red-400',     '#f87171'),
  post_edited:               A(Pencil,       'text-gray-400',    '#9ca3af'),
  post_deleted:              A(Trash2,       'text-red-400',     '#f87171'),

  // conteúdo — comentários e mural
  comment_added:             A(MessageSquare,  'text-neon-cyan', '#22d3ee'),
  comment_deleted:           A(MessageSquare,  'text-red-400',   '#f87171'),
  mural_post:                A(MessagesSquare, 'text-neon-purple','#bf00ff'),
  mural_delete:              A(MessagesSquare, 'text-red-400',   '#f87171'),

  // lives
  live_created:              A(Radio,        'text-red-400',     '#f87171'),
  live_ended:                A(Tv,           'text-gray-500',    '#6b7280'),
  live_reactivated:          A(RotateCcw,    'text-neon-green',  '#39ff14'),
  live_chat_delete:          A(Trash2,       'text-red-400',     '#f87171'),
  live_silence:              A(MicOff,       'text-yellow-400',  '#facc15'),
  live_unsilence:            A(Mic,          'text-neon-green',  '#39ff14'),

  // perfil
  profile_updated:           A(UserCog,      'text-neon-purple', '#bf00ff'),
  profile_avatar_updated:    A(Image,        'text-neon-purple', '#bf00ff'),
};

export const DEFAULT_ACTION_META = A(ScrollText, 'text-gray-500', '#6b7280');

export function actionMeta(action) {
  return ACTION_META[action] || DEFAULT_ACTION_META;
}

// ─── Notificações de staff (`admin_notifications.type`) ──────────────────────
// Os dois painéis (admin e dono) liam esses tipos com mapas próprios e
// incompletos. Vários tipos que o banco realmente gera — suspensão, banimento
// automático, negação de desban — caíam no ícone genérico.
export const NOTIF_META = {
  new_user:             A(UserPlus,    'text-neon-cyan',   '#22d3ee'),
  new_live:             A(Radio,       'text-red-400',     '#f87171'),
  live_ended:           A(Tv,          'text-gray-500',    '#6b7280'),
  live_reactivated:     A(RotateCcw,   'text-neon-green',  '#39ff14'),
  reactivation_request: A(RotateCcw,   'text-yellow-400',  '#facc15'),
  user_banned:          A(Ban,         'text-red-400',     '#f87171'),
  user_suspended:       A(Clock,       'text-yellow-400',  '#facc15'),
  auto_ban:             A(ShieldOff,   'text-red-500',     '#ef4444'),
  auto_suspend:         A(ShieldAlert, 'text-yellow-400',  '#facc15'),
  unban_request:        A(RotateCcw,   'text-yellow-400',  '#facc15'),
  unban_approved:       A(CheckCircle, 'text-neon-green',  '#39ff14'),
  unban_denied:         A(XCircle,     'text-red-400',     '#f87171'),
  role_changed:         A(Crown,       'text-yellow-400',  '#facc15'),
  banned_login_attempt: A(ShieldAlert, 'text-red-400',     '#f87171'),
  staff_alert:          A(Siren,       'text-red-400',     '#ef4444'),
};

export const DEFAULT_NOTIF_META = A(Bell, 'text-gray-500', '#6b7280');

export function notifMeta(type) {
  return NOTIF_META[type] || DEFAULT_NOTIF_META;
}

// O painel do dono recebe itens de `admin_logs` (têm `action`) e de
// `admin_notifications` (têm `type`) na mesma lista.
export function feedItemMeta(item) {
  return NOTIF_META[item?.kind] || ACTION_META[item?.action] || DEFAULT_NOTIF_META;
}

// ─── Retenção ────────────────────────────────────────────────────────────────
// Precisa bater com `cleanup_old_data()` em `db/2026-08-otimizacao.sql`.
// Mostrado nos painéis pra ninguém achar que log sumido é bug.
export const LOG_RETENTION_DAYS = 90;
