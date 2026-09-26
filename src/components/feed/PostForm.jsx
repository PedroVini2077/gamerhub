import { memo } from 'react';
import { suspendedUntil } from '../../lib/roles';
import SuspendedNotice from '../ui/SuspendedNotice';
import AudioRecorder from '../ui/AudioRecorder';
import { usePostComposer, MAX_MEDIAS } from '../../hooks/usePostComposer';
import AudioAttachment from './composer/AudioAttachment';
import EmbedComposer from './composer/EmbedComposer';
import MediaPreviewGrid from './composer/MediaPreviewGrid';
import ComposerToolbar from './composer/ComposerToolbar';
import EditorDeTexto from '../ui/EditorDeTexto';

/**
 * `[26/09]` O compositor vive em DOIS lugares, e o `amplo` é a diferença.
 *
 * No feed ele não vive mais: lá ficou só uma linha que leva para `/publicar`
 * (`LinhaDePublicar`). Aqui o `amplo` é o modo da **rota própria** — sem o
 * título "Novo Post" repetindo o cabeçalho da página, e com o editor maior.
 *
 * A decisão é dele, de 25/09: *"se fosse só um modal, ia continuar pequeno na
 * minha opinião"*. Um modal herda a largura do que está atrás; uma rota manda
 * na tela inteira.
 */
function Shell({ amplo, children }) {
  if (amplo) return <div className="card p-5 md:p-6">{children}</div>;
  return (
    <div className="card p-5">
      <h3 className="font-display text-xs text-neon-green tracking-widest uppercase mb-4">Novo Post</h3>
      {children}
    </div>
  );
}

const PostForm = memo(function PostForm({ onPost, amplo = false }) {
  const {
    user, profile, title, setTitle, content, setContent,
    medias, audio, audioName, setAudioName,
    embedUrl, setEmbedUrl, showEmbed, setShowEmbed, closeEmbed,
    isLive, setIsLive, showRecorder, setShowRecorder,
    loading, fileRef, audioFileRef,
    handleMediaSelect, handleFileChange, handleAudioFile, handleRecorded,
    removeMedia, removeAudio, handleSubmit,
  } = usePostComposer(onPost);

  if (!user) return null;

  const suspended = suspendedUntil(profile);
  if (suspended) return <Shell amplo={amplo}><SuspendedNotice until={suspended} /></Shell>;

  return (
    <Shell amplo={amplo}>
      <input id="post-title" aria-label="Título do post" className="input-gamer mb-3"
        placeholder="Título do post..."
        value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />

      {audio ? (
        <>
          <AudioAttachment audio={audio} audioName={audioName}
            setAudioName={setAudioName} onRemove={removeAudio} />
          <textarea aria-label="Legenda do áudio" className="input-gamer mb-3 resize-none" rows={2}
            placeholder="Legenda opcional..."
            value={content} onChange={e => setContent(e.target.value)} maxLength={300} />
        </>
      ) : (
        /* `[25/09]` O compositor ganhou barra de ferramentas e prévia. A dica
           escrita saiu junto: botão que faz é melhor do que texto que ensina. */
        <EditorDeTexto id="post-content" value={content} onChange={setContent}
          placeholder="Escreva algo... (opcional se tiver áudio ou link)"
          maxLength={1000} rows={amplo ? 10 : 3} />
      )}

      {showEmbed && (
        <EmbedComposer embedUrl={embedUrl} setEmbedUrl={setEmbedUrl}
          isLive={isLive} setIsLive={setIsLive} onClose={closeEmbed} />
      )}

      {showRecorder && (
        <AudioRecorder onRecorded={handleRecorded} onCancel={() => setShowRecorder(false)} />
      )}

      {medias.length > 0 && (
        <MediaPreviewGrid medias={medias} max={MAX_MEDIAS} onRemove={removeMedia} />
      )}

      <ComposerToolbar
        canAddMedia={medias.length < MAX_MEDIAS}
        hasAudio={!!audio} showRecorder={showRecorder} showEmbed={showEmbed}
        onPickImage={() => handleMediaSelect('image')}
        onPickVideo={() => handleMediaSelect('video')}
        onPickAudio={() => audioFileRef.current.click()}
        onRecord={() => setShowRecorder(true)}
        onAddEmbed={() => setShowEmbed(true)}
        loading={loading} onSubmit={handleSubmit}
        perfilPronto={!!profile?.id}
      />

      <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
      <input ref={audioFileRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioFile} />
    </Shell>
  );
});

export default PostForm;
