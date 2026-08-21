import { memo } from 'react';
import { suspendedUntil } from '../../lib/roles';
import SuspendedNotice from '../ui/SuspendedNotice';
import AudioRecorder from '../ui/AudioRecorder';
import { usePostComposer, MAX_MEDIAS } from '../../hooks/usePostComposer';
import AudioAttachment from './composer/AudioAttachment';
import EmbedComposer from './composer/EmbedComposer';
import MediaPreviewGrid from './composer/MediaPreviewGrid';
import ComposerToolbar from './composer/ComposerToolbar';

function Shell({ children }) {
  return (
    <div className="card p-5">
      <h3 className="font-display text-xs text-neon-green tracking-widest uppercase mb-4">Novo Post</h3>
      {children}
    </div>
  );
}

const PostForm = memo(function PostForm({ onPost }) {
  const {
    user, profile, title, setTitle, content, setContent, category, setCategory,
    medias, audio, audioName, setAudioName,
    embedUrl, setEmbedUrl, showEmbed, setShowEmbed, closeEmbed,
    isLive, setIsLive, showRecorder, setShowRecorder,
    loading, fileRef, audioFileRef,
    handleMediaSelect, handleFileChange, handleAudioFile, handleRecorded,
    removeMedia, removeAudio, handleSubmit,
  } = usePostComposer(onPost);

  if (!user) return null;

  const suspended = suspendedUntil(profile);
  if (suspended) return <Shell><SuspendedNotice until={suspended} /></Shell>;

  return (
    <Shell>
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
        <textarea id="post-content" aria-label="Conteúdo do post" className="input-gamer mb-3 resize-none" rows={3}
          placeholder="Escreva algo... (opcional se tiver áudio ou link)"
          value={content} onChange={e => setContent(e.target.value)} maxLength={1000} />
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
        category={category} setCategory={setCategory}
        canAddMedia={medias.length < MAX_MEDIAS}
        hasAudio={!!audio} showRecorder={showRecorder} showEmbed={showEmbed}
        onPickImage={() => handleMediaSelect('image')}
        onPickVideo={() => handleMediaSelect('video')}
        onPickAudio={() => audioFileRef.current.click()}
        onRecord={() => setShowRecorder(true)}
        onAddEmbed={() => setShowEmbed(true)}
        loading={loading} onSubmit={handleSubmit}
      />

      <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
      <input ref={audioFileRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioFile} />
    </Shell>
  );
});

export default PostForm;
