import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LoaderCircle, MessageSquare, SendHorizonal } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import { createLobbyMessage, fetchLobbyMessages } from '../lib/appData';
import { requireSupabase } from '../lib/supabase';
import type { AuthUser, LobbyMessage } from '../types';

type LobbyChatProps = {
  lobbyId: string;
  currentUser: AuthUser | null;
  canViewChat: boolean;
  canSendChat: boolean;
};

function formatMessageTimestamp(value: string, locale: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (sameDay) {
    return time;
  }

  const day = date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });

  return `${day}, ${time}`;
}

export default function LobbyChat({ lobbyId, currentUser, canViewChat, canSendChat }: LobbyChatProps) {
  const { lang } = useLang();
  const locale = lang === 'he' ? 'he-IL' : 'en-US';
  const [messages, setMessages] = useState<LobbyMessage[]>([]);
  const [loading, setLoading] = useState(canViewChat);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    if (!canViewChat) {
      setMessages([]);
      setLoading(false);
      setError('');
      return;
    }

    const supabase = requireSupabase();
    let cancelled = false;

    async function loadMessages(showSpinner: boolean) {
      try {
        if (showSpinner) {
          setLoading(true);
        }
        const nextMessages = await fetchLobbyMessages(lobbyId);
        if (!cancelled) {
          setMessages(nextMessages);
          setError('');
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load lobby chat.');
        }
      } finally {
        if (!cancelled && showSpinner) {
          setLoading(false);
        }
      }
    }

    void loadMessages(true);

    const channel = supabase
      .channel(`lobby-chat:${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobby_messages',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => {
          void loadMessages(false);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [canViewChat, lobbyId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser || !canSendChat || sending) {
      return;
    }

    const nextMessage = draft.trim();
    if (nextMessage.length === 0) {
      return;
    }

    setSending(true);
    setError('');
    try {
      await createLobbyMessage(lobbyId, currentUser.id, nextMessage);
      setDraft('');
      const nextMessages = await fetchLobbyMessages(lobbyId);
      setMessages(nextMessages);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  const copy = {
    title: lang === 'he' ? 'צ׳אט הלובי' : 'Lobby chat',
    subtitle: lang === 'he' ? 'לעדכונים מהירים על איחורים, חוסרים ושינויים.' : 'Quick updates about delays, missing players, and changes.',
    empty: lang === 'he' ? 'עוד אין הודעות. תתחילו לעדכן כאן.' : 'No messages yet. Start the conversation here.',
    placeholder: lang === 'he' ? 'למשל: אני מאחר ב-10 דקות' : 'For example: I am running 10 minutes late',
    send: lang === 'he' ? 'שלח' : 'Send',
    sending: lang === 'he' ? 'שולח...' : 'Sending...',
    locked: lang === 'he' ? 'רק משתתפי הלובי יכולים לראות ולכתוב בצ׳אט.' : 'Only lobby participants can view and post in chat.',
    joinHint: lang === 'he' ? 'הצטרפו ללובי כדי לפתוח את הצ׳אט.' : 'Join the lobby to unlock the chat.',
    loadError: lang === 'he' ? 'לא הצלחנו לטעון את הצ׳אט כרגע.' : 'We could not load the chat right now.',
  };

  if (!currentUser) {
    return null;
  }

  if (!canViewChat) {
    return (
      <section className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-gray-100 p-3 text-gray-600">
            <MessageSquare size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{copy.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{copy.locked}</p>
            <p className="mt-2 text-xs text-gray-400">{copy.joinHint}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-2xl bg-primary-50 p-3 text-primary-700">
          <MessageSquare size={18} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{copy.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{copy.subtitle}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
        <div className="max-h-80 space-y-3 overflow-y-auto pe-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <LoaderCircle size={16} className="animate-spin" />
              <span>{lang === 'he' ? 'טוען צ׳אט...' : 'Loading chat...'}</span>
            </div>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">{copy.empty}</p>
          ) : (
            messages.map((message) => {
              const isMine = message.profileId === currentUser.id;
              return (
                <div
                  key={message.id}
                  className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${isMine ? 'ms-auto bg-primary-600 text-white' : 'bg-white text-gray-900'}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {message.author.photoUrl ? (
                      <img
                        src={message.author.photoUrl}
                        alt={message.author.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white ${message.author.avatarColor}`}>
                        {message.author.initials}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${isMine ? 'text-white' : 'text-gray-900'}`}>
                        {message.author.name}
                      </p>
                      <p className={`text-xs ${isMine ? 'text-primary-100' : 'text-gray-400'}`}>
                        {formatMessageTimestamp(message.createdAt, locale)}
                      </p>
                    </div>
                  </div>
                  <p className={`whitespace-pre-wrap break-words text-sm leading-6 ${isMine ? 'text-white' : 'text-gray-700'}`}>
                    {message.body}
                  </p>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-500">
            {error || copy.loadError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 500))}
            disabled={!canSendChat || sending}
            maxLength={500}
            placeholder={copy.placeholder}
            className="h-12 flex-1 rounded-2xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition-colors focus:border-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canSendChat || sending || draft.trim().length === 0}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? <LoaderCircle size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
            <span>{sending ? copy.sending : copy.send}</span>
          </button>
        </form>
      </div>
    </section>
  );
}
