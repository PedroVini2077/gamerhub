import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { updateProfile, uploadAvatar } from '../services/profileService';
import { compressImage } from '../lib/image';
import { logAudit } from '../lib/auditLog';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Troca de foto de perfil: valida, comprime, sobe e grava no profile. */
export function useAvatarUpload({ user, profile, refreshProfile }) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (profile) setAvatarUrl(profile.avatar_url);
    // Só quando o USUÁRIO muda — ver o comentário em useProfileForm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG, WEBP ou GIF.');
      return;
    }
    setUploading(true);
    toast.loading('Processando imagem...', { id: 'upload' });
    // 256px basta: o maior lugar onde o avatar aparece é o card de perfil.
    // Menos bytes por avatar = menos egress em todo card do feed.
    const compressed = await compressImage(file, { maxSize: 256, quality: 0.8 });
    const { url, error: uploadError } = await uploadAvatar(user.id, compressed);
    if (uploadError) {
      toast.error('Erro ao fazer upload', { id: 'upload' });
      setUploading(false);
      return;
    }
    const { error: updateError } = await updateProfile(user.id, { avatar_url: url });
    if (updateError) {
      toast.error('Erro ao salvar avatar', { id: 'upload' });
    } else {
      setAvatarUrl(url);
      await refreshProfile();
      toast.success('Avatar atualizado!', { id: 'upload' });
      logAudit('profile_avatar_updated', `@${profile?.username} atualizou o avatar`, { category: 'profile' });
    }
    setUploading(false);
  }

  return { avatarUrl, uploading, fileRef, handleAvatarUpload };
}
