-- Por que esta migracao existe
--
-- O dono testou "vai tomar no cu" e o post passou limpo: nem oculto, nem na
-- fila. O trigger `checar_palavras_bloqueadas` estava certo — quem falhou foi
-- a COBERTURA da lista. O seed inicial (161 termos) nao tinha `cu` nem
-- nenhuma das construcoes em volta dele, nem os xingamentos mais banais
-- (idiota, burro, cala a boca), nem as abreviacoes que o pessoal usa hoje.
--
-- Junto vai uma incoerencia de severidade que o mesmo teste expos:
-- `vai se matar` estava como `high` (oculta) e `se mata` / `mata se` como
-- `medium` (so enfileira). E a mesma incitacao ao suicidio escrita de dois
-- jeitos — a severidade tem de ser a mesma.
--
-- Criterio mantido do seed original:
--   high   = discurso de odio, conteudo sexual/infantil, incitacao a
--            suicidio ou violencia. Oculta na hora e vai pra fila.
--   medium = palavrao e xingamento comum. Publica, mas vai pra fila.

-- 1. Incitacao ao suicidio: mesma coisa que `vai se matar`, mesma severidade.
UPDATE public.blocked_words SET severity = 'high'
 WHERE word IN ('se mata', 'mata se');

-- 2. Termos novos. `WHERE NOT EXISTS` porque a migracao precisa poder rodar
--    duas vezes sem estourar (nao ha unique em `word`).
INSERT INTO public.blocked_words (word, severity, created_by)
SELECT v.word, v.severity, NULL
  FROM (VALUES
    -- ── HIGH: violencia sexual ────────────────────────────────────────────
    ('estupro','high'), ('estuprar','high'), ('estuprador','high'),
    ('vou te estuprar','high'), ('rape','high'), ('rapist','high'),
    ('chupa meu pau','high'), ('chupar meu pau','high'),
    ('senta na minha rola','high'), ('senta no meu pau','high'),
    ('crianca nua','high'), ('criança nua','high'),
    ('novinha safada','high'), ('novinhas safadas','high'),
    ('menor de idade pelada','high'), ('foto pelada','high'),
    ('fotos peladas','high'), ('mando foto pelada','high'),
    ('nudez','high'), ('camgirl','high'), ('camsoda','high'),
    ('chaturbate','high'), ('privacy','high'), ('close friends +18','high'),

    -- ── HIGH: incitacao a suicidio e a morte ──────────────────────────────
    ('se enforca','high'), ('se enforque','high'), ('se mate','high'),
    ('vai se enforcar','high'), ('morre logo','high'), ('vai morrer','high'),
    ('te mato','high'), ('vou te matar','high'), ('vou te achar','high'),
    ('sei onde voce mora','high'), ('sei onde você mora','high'),
    ('kill urself','high'), ('go kill yourself','high'), ('kys agora','high'),

    -- ── HIGH: discurso de odio ────────────────────────────────────────────
    ('mongol','high'), ('mongoloides','high'), ('mongolóides','high'),
    ('judeu de merda','high'), ('preto fedido','high'), ('negro fedido','high'),
    ('volta pra africa','high'), ('volta pra áfrica','high'),
    ('macaca fedida','high'), ('bicha nojenta','high'), ('viado nojento','high'),
    ('sapatao nojenta','high'), ('sapatão nojenta','high'),
    ('travesti de merda','high'), ('veadinho','high'), ('bichinha','high'),
    ('boiolinha','high'), ('sapatona','high'), ('tranny bitch','high'),

    -- ── MEDIUM: o basico que faltava ──────────────────────────────────────
    ('cu','medium'), ('cú','medium'), ('cuzinho','medium'),
    ('tomar no cu','medium'), ('toma no cu','medium'), ('tomar no cú','medium'),
    ('enfia no cu','medium'), ('enfia no cú','medium'), ('pau no cu','medium'),
    ('vai tomar no cu','medium'), ('vai tomar no cú','medium'),
    ('vai se foder','medium'), ('vai se fuder','medium'), ('foda se','medium'),
    ('foda-se','medium'), ('que se foda','medium'),
    ('puta que pariu','medium'), ('puta merda','medium'), ('putinha','medium'),
    ('putinho','medium'), ('putona','medium'),

    -- ── MEDIUM: xingamento direto a pessoa ────────────────────────────────
    ('idiota','medium'), ('idiotas','medium'), ('burro','medium'),
    ('burra','medium'), ('estupido','medium'), ('estúpido','medium'),
    ('estupida','medium'), ('estúpida','medium'), ('jumento','medium'),
    ('anta','medium'), ('trouxa','medium'), ('panaca','medium'),
    ('pateta','medium'), ('mane','medium'), ('mané','medium'),
    ('nojento','medium'), ('nojenta','medium'), ('chifrudo','medium'),
    ('seu lixo','medium'), ('e um lixo','medium'), ('é um lixo','medium'),
    ('lixo de gente','medium'), ('cala boca','medium'), ('cala a boca','medium'),
    ('calaboca','medium'), ('some daqui','medium'),
    ('ninguem gosta de voce','medium'), ('ninguém gosta de você','medium'),
    ('gorda nojenta','medium'), ('gordo nojento','medium'),
    ('aleijado','medium'), ('retardadinho','medium'),

    -- ── MEDIUM: abreviacoes e leet ────────────────────────────────────────
    ('vtmnc','medium'), ('vtmn','medium'), ('tmnc','medium'), ('fdc','medium'),
    ('pnc','medium'), ('krlh','medium'), ('krlho','medium'), ('mrd','medium'),
    ('mrda','medium'), ('ptqp','medium'), ('pqpp','medium'), ('caralio','medium'),
    ('p0rra','medium'), ('p0rn0','high'), ('c4ralho','medium'),
    ('put4','medium'), ('vi4do','medium'), ('f0da','medium'),
    ('arr0mbado','medium'), ('buc3ta','high'), ('n00b de merda','medium'),

    -- ── MEDIUM: ingles ────────────────────────────────────────────────────
    ('stfu','medium'), ('gtfo','medium'), ('dumb','medium'), ('stupid','medium'),
    ('loser','medium'), ('idiot','medium'), ('moron','medium'),
    ('dickhead','medium'), ('douchebag','medium'), ('prick','medium'),
    ('wanker','medium'), ('twat','medium'), ('slut','high'), ('whore','high'),
    ('trash player','medium'), ('kill yourself now','high')
  ) AS v(word, severity)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.blocked_words b WHERE lower(b.word) = lower(v.word)
 );;
