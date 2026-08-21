import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { updateProfile } from '../services/profileService';
import { logAudit } from '../lib/auditLog';

const MIN_AGE_YEARS = 13;

const EMPTY = {
  bio: '', birth_date: '', state: '', platform: '', playstyle: '',
  favorite_games: '', discord: '', twitch: '', youtube: '',
};

// Campos que vão para o banco como NULL quando ficam vazios, e quais deles
// passam por trim antes. `bio` fica de fora de propósito: string vazia é um
// valor válido ali (a pessoa apagou a bio).
const NULLABLE = ['birth_date', 'state', 'platform', 'playstyle'];
const TRIMMED = ['favorite_games', 'discord', 'twitch', 'youtube'];

/** Formulário do próprio perfil: carrega, edita e salva. */
export function useProfileForm({ user, profile, refreshProfile }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // Data máxima aceita no campo de nascimento (idade mínima). Calculada uma vez
  // na montagem — `Date.now()` no corpo do render é impuro e o valor não muda
  // de forma relevante durante a sessão.
  const [maxBirthDate] = useState(
    () => new Date(Date.now() - MIN_AGE_YEARS * 365.25 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0],
  );

  const setField = (name, value) => setForm(f => ({ ...f, [name]: value }));

  // Só popula o form a partir do profile quando o USUÁRIO muda (login/logout) —
  // não a cada novo objeto `profile` (poll de 20s / realtime / refreshProfile()
  // após salvar). Caso contrário, qualquer refresh em segundo plano sobrescreve
  // o que o usuário está digitando, "resetando" o formulário no meio da edição.
  useEffect(() => {
    if (!profile) return;
    setForm(Object.fromEntries(
      Object.keys(EMPTY).map(k => [k, profile[k] || '']),
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function save() {
    setSaving(true);
    const updates = { bio: form.bio };
    for (const k of NULLABLE) updates[k] = form[k] || null;
    for (const k of TRIMMED) updates[k] = form[k].trim() || null;

    const { error } = await updateProfile(user.id, updates);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else {
      await refreshProfile();
      toast.success('Perfil atualizado!');
      logAudit('profile_updated', `@${profile?.username} atualizou o perfil`, { category: 'profile' });
    }
    setSaving(false);
  }

  return { form, setField, saving, save, maxBirthDate };
}
