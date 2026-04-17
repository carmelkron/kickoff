import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Users, Lock, Handshake, Trophy } from 'lucide-react';
import { Lobby } from '../types';
import { useLang } from '../contexts/LanguageContext';
import { formatDateTime } from '../utils/format';
import { formatAgeRange } from '../utils/age';
import { formatLocationLabel } from '../utils/location';
import PlayerAvatarStack from './PlayerAvatarStack';

interface Props {
  lobby: Lobby;
  distanceLabel?: string;
  distanceNote?: string;
}

function avgCompetitivePoints(lobby: Lobby) {
  if (lobby.players.length === 0) return null;
  const sum = lobby.players.reduce((acc, p) => acc + (p.competitivePoints ?? 0), 0);
  return sum / lobby.players.length;
}

export default function LobbyCard({ lobby, distanceLabel, distanceNote }: Props) {
  const navigate = useNavigate();
  const { t, lang } = useLang();

  const isFull = lobby.players.length >= lobby.maxPlayers;
  const spotsLeft = lobby.maxPlayers - lobby.players.length;
  const dateStr = formatDateTime(lobby.datetime, lang, t.common.today, t.common.tomorrow);
  const avg = avgCompetitivePoints(lobby);
  const shownDistanceLabel = distanceLabel ?? `${lobby.distanceKm} ${t.common.km}`;
  const ageRangeLabel = formatAgeRange(lobby.minAge, lobby.maxAge, lang);

  return (
    <div
      onClick={() => navigate(`/lobby/${lobby.id}`)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {(lobby.isPrivate || lobby.accessType === 'locked') && <Lock size={13} className="text-gray-400 shrink-0" />}
            <h3 className="font-semibold text-gray-900 text-base leading-tight truncate">
              {lobby.title}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm text-gray-500">{lobby.city}</p>
            <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${lobby.gameType === 'competitive' ? 'bg-primary-100 text-primary-700' : 'bg-green-100 text-green-700'}`}>
              {lobby.gameType === 'competitive' ? <Trophy size={10} /> : <Handshake size={10} />}
            </span>
            {lobby.fieldType && (
              <span className="text-xs text-gray-400">
                {lobby.fieldType === 'grass' ? '🌿' : lobby.fieldType === 'asphalt' ? '⬛' : '🏟️'}
              </span>
            )}
            {lobby.genderRestriction !== 'none' && (
              <span className="text-xs text-gray-400">
                {lobby.genderRestriction === 'male' ? '👨' : '👩'}
              </span>
            )}
            {lobby.accessType === 'locked' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-700">
                <Lock size={10} />
                {lang === 'he' ? 'נעול' : 'Locked'}
              </span>
            )}
            {lobby.accessType === 'locked' && !lobby.viewerHasAccess && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                {lang === 'he' ? 'דורש אישור' : 'Approval required'}
              </span>
            )}
            {ageRangeLabel && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                {ageRangeLabel}
              </span>
            )}
          </div>
        </div>
        {avg !== null && lobby.gameType === 'competitive' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
            <Trophy size={11} />
            {Math.round(avg)}
          </span>
        )}
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-gray-400 shrink-0" />
          <span className="truncate">{formatLocationLabel(lobby.address, lobby.city)}</span>
          <span className="shrink-0 ms-auto text-end">
            <span className="block text-gray-400">{shownDistanceLabel}</span>
            {distanceNote && (
              <span className="block text-[11px] text-gray-400">{distanceNote}</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gray-400 shrink-0" />
          <span>{dateStr}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users size={14} className="text-gray-400 shrink-0" />
          <span>{lobby.players.length}/{lobby.maxPlayers} {t.lobby.players}</span>
          {!isFull && (
            <span className="text-primary-600 font-medium ms-auto">{spotsLeft} {t.lobby.spotsLeft}</span>
          )}
          {isFull && (
            <span className="text-red-500 font-medium ms-auto">{t.lobby.full}</span>
          )}
        </div>
        {lobby.minRating && lobby.gameType === 'competitive' && (
          <div className="text-xs text-gray-400">
            {lang === 'he' ? `מינימום: ${Math.round(lobby.minRating)} נק׳` : `Min: ${Math.round(lobby.minRating)} pts`}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <PlayerAvatarStack players={lobby.players} />
        <div className="text-sm font-semibold text-gray-700">
          {lobby.price && lobby.price > 0
            ? `${lobby.price} ${t.lobby.perPerson}`
            : <span className="text-primary-600">{t.lobby.free}</span>}
        </div>
      </div>
    </div>
  );
}
