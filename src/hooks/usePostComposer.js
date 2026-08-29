import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { createPost, uploadAudio, uploadPostMediaFiles } from '../services/postService';
import { moderateText, moderateImages, moderateVideos, moderateLinks } from '../services/moderationAiService';
import { useAuth } from './useAuth.jsx';
import { useBlockedWords } from './useBlockedWords';
import { getEmbedInfo } from '../lib/embed';
import { createUrlTracker } from '../lib/objectUrls';

export const MAX_MEDIAS = 10;
// Vídeo limitado a 10MB: egress (banda CDN) é a cota mais apertada do free
// tier — clipes longos devem ir via embed YouTube/Twitch/TikTok.
const MAX_MB = { image: 5, video: 10 };
const MAX_AUDIO_MB = 20;

/** Estado e ações do formulário de novo post. */
export function usePostComposer(onPost) {
  const { user, profile } = useAuth();
  const { checkContent } = useBlockedWords();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('dica');
  const [medias, setMedias] = useState([]);
  const [audio, setAudio] = useState(null);
  const [audioName, setAudioName] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [showEmbed, setShowEmbed] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState(null);
  const fileRef = useRef(null);
  const audioFileRef = useRef(null);

  // As prévias de mídia e áudio são blob URLs — ver lib/objectUrls.js para o
  // vazamento que isto fecha. Lazy: um rastreador por instância do formulário.
  const [urls] = useState(createUrlTracker);

  // Desmontar o formulário com anexos pendentes (trocar de página, sair da
  // conta) também precisa devolver a memória.
  useEffect(() => () => urls.releaseAll(), [urls]);

  function handleMediaSelect(type) {
    if (medias.length >= MAX_MEDIAS) { toast.error(`Máximo ${MAX_MEDIAS} mídias por post`); return; }
    setActiveType(type);
    fileRef.current.accept = type === 'image' ? 'image/*' : 'video/*';
    fileRef.current.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxMB = MAX_MB[activeType];
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(activeType === 'video'
        ? `Máximo ${maxMB}MB — pra vídeos maiores, cole um link do YouTube/Twitch/TikTok`
        : `Máximo ${maxMB}MB`);
      e.target.value = '';
      return;
    }
    setMedias(m => [...m, { file, preview: urls.track(file), type: activeType }]);
    e.target.value = '';
  }

  function handleAudioFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      toast.error(`Máximo ${MAX_AUDIO_MB}MB para áudio`);
      return;
    }
    setAudio({ file, preview: urls.track(file), type: 'file' });
    setAudioName(file.name.replace(/\.[^/.]+$/, ''));
    e.target.value = '';
  }

  function handleRecorded(file) {
    setAudio({ file, preview: urls.track(file), type: 'recorded' });
    setAudioName('Áudio gravado');
    setShowRecorder(false);
  }

  function removeMedia(i) {
    setMedias(m => { urls.release(m[i].preview); return m.filter((_, idx) => idx !== i); });
  }

  function removeAudio() {
    urls.release(audio?.preview);
    setAudio(null);
    setAudioName('');
  }

  function closeEmbed() {
    setShowEmbed(false);
    setEmbedUrl('');
    setIsLive(false);
  }

  async function handleSubmit() {
    if (!title.trim()) { toast.error('Preencha o título!'); return; }
    if (embedUrl.trim() && !getEmbedInfo(embedUrl.trim())) {
      toast.error('Link não suportado. Use YouTube, Twitch ou TikTok.');
      return;
    }
    if (checkContent(`${title} ${content}`).blocked) {
      toast.error('Conteúdo não permitido: contém termo bloqueado.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Processando post...');

    try {
      let audio_url = null;
      let audio_type = null;

      if (audio?.file) {
        const { data: url, error } = await uploadAudio(user.id, audio.file);
        if (error) throw error;
        audio_url = url;
        audio_type = audio.type === 'recorded' ? 'recorded' : 'music';
      }

      const { data: post, error: postError } = await createPost({
        userId: profile?.id,
        title: title.trim(),
        content: content.trim() || null,
        category,
        audioUrl: audio_url,
        audioType: audio_type,
        audioName: audioName.trim() || null,
        embedUrl: embedUrl.trim() || null,
        isLive,
      });

      if (postError) throw postError;

      if (medias.length > 0) {
        const { data: { imageUrls, videoUrls, failed } = {} } = await uploadPostMediaFiles(user.id, post.id, medias);
        // O post já foi criado — avisar é melhor do que deixar o usuário achar
        // que a mídia subiu e só descobrir olhando o card.
        if (failed) toast.error(`${failed} mídia(s) não puderam ser enviadas.`);
        moderateImages('post', post.id, imageUrls);
        // Vídeo era o único tipo de mídia que subia sem NENHUMA checagem: só
        // `type === 'image'` entrava em `imageUrls`. Agora alguns quadros são
        // extraídos no navegador e vão pela mesma moderação de imagem.
        //
        // Os arquivos vêm de `medias`, e não do que voltou do upload, porque a
        // extração precisa do arquivo local — baixar o vídeo do storage de
        // volta só para moderar pagaria egress à toa (§6.1).
        // `[28/08]` O resultado deixou de ser descartado. Antes esta linha era
        // uma promessa solta, sem `.then` e sem `.catch`: se a extração de
        // quadros falhasse — ou se ela LANÇASSE — o vídeo subia sem análise
        // nenhuma e ninguém ficava sabendo. Foi o que aconteceu no teste do
        // dono: `moderate-image` não foi chamada uma vez sequer.
        //
        // Continua fire-and-forget (publicar não espera moderação), mas agora
        // quem publicou é avisado quando o vídeo não pôde ser checado. Aviso na
        // tela é um dos três canais do §1.5 — e é o único disponível aqui, já
        // que a trilha de `admin_logs` só aceita `service_role`.
        // `Promise.resolve(...)` e não `.then` direto: a moderação é enfeite no
        // caminho crítico de PUBLICAR. Se ela um dia deixar de devolver
        // promessa, o `.then` estouraria aqui e derrubaria o resto do fluxo —
        // inclusive o `releaseAll()` que solta os blobs das prévias. O teste
        // unitário pegou exatamente isso. Moderação pode falhar; publicar, não.
        Promise.resolve(
          moderateVideos(
            'post', post.id,
            medias.filter(m => m.type === 'video').map(m => m.file),
            // As URLs já publicadas, na mesma ordem, para o plano B: se o
            // navegador recusar o arquivo local, a moderação tenta a mídia que
            // acabou de subir para o storage.
            videoUrls,
          ),
        )
          .then((r) => {
            if (r?.semQuadros) {
              // Sem `icon:` — emoji na UI é proibido (§4). O texto carrega o
              // aviso sozinho.
              // O motivo vai NO TEXTO. Sem ele o aviso dizia apenas que algo
              // deu errado, e as cinco causas possíveis pedem correções
              // completamente diferentes — foi exatamente esse aviso mudo que
              // custou uma segunda rodada de investigação em 29/08.
              const causa = r.motivos?.filter(Boolean).join(' · ');
              toast(
                `${r.semQuadros} vídeo(s) não puderam ser analisados automaticamente. `
                + 'O post foi publicado e pode ser revisado pela equipe.'
                + (causa ? `\nMotivo: ${causa}` : ''),
                { duration: 12000 },
              );
            }
          })
          .catch(() => {
            toast('Não foi possível analisar o vídeo automaticamente.', { duration: 6000 });
          });
      }

      toast.success('Post publicado!', { id: toastId });
      moderateText('post', post.id, `${title.trim()} ${content.trim()}`);
      if (embedUrl.trim()) moderateLinks('post', post.id, embedUrl.trim());
      // logAudit omitido: o trigger log_post_event no banco já gera
      // content_post_created.
      // releaseAll e não um loop pelas mídias: aqui o formulário inteiro está
      // sendo zerado, e `setMedias([])`/`setAudio(null)` só soltam a referência
      // do React — os blobs continuariam vivos no navegador. Varrer tudo de uma
      // vez também não deixa caminho novo passar despercebido.
      urls.releaseAll();
      setTitle(''); setContent(''); setMedias([]);
      setAudio(null); setAudioName('');
      setEmbedUrl(''); setShowEmbed(false);
      setIsLive(false);
      onPost?.();
    } catch (err) {
      toast.error('Erro: ' + err.message, { id: toastId });
    }
    setLoading(false);
  }

  return {
    user, profile,
    title, setTitle, content, setContent, category, setCategory,
    medias, audio, audioName, setAudioName,
    embedUrl, setEmbedUrl, showEmbed, setShowEmbed, closeEmbed,
    isLive, setIsLive, showRecorder, setShowRecorder,
    loading, fileRef, audioFileRef,
    handleMediaSelect, handleFileChange, handleAudioFile, handleRecorded,
    removeMedia, removeAudio, handleSubmit,
  };
}
