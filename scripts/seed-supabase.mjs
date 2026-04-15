import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const mockDataPath = path.join(rootDir, 'src', 'data', 'mockData.ts');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your environment.');
  process.exit(1);
}

function transformMockDataSource(source) {
  return source
    .replace(/import\s+\{\s*Player,\s*Lobby\s*\}\s+from\s+'..\/types';\s*/u, '')
    .replace(/const D = \(offsetDays: number, hour: number, min = 0\) => \{/u, 'const D = (offsetDays, hour, min = 0) => {')
    .replace(/export const mockPlayers: Player\[\] =/u, 'const mockPlayers =')
    .replace(/export const mockLobbies: Lobby\[\] =/u, 'const mockLobbies =');
}

async function loadMockData() {
  const source = await readFile(mockDataPath, 'utf8');
  const transformed = transformMockDataSource(source);
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${transformed}\nglobalThis.__seed = { mockPlayers, mockLobbies };`, context);
  return context.__seed;
}

function mapProfile(player) {
  return {
    id: player.id,
    auth_user_id: null,
    email: player.email ?? null,
    name: player.name,
    initials: player.initials,
    avatar_color: player.avatarColor,
    rating: player.rating,
    games_played: player.gamesPlayed,
    position: player.position ?? null,
    bio: player.bio ?? null,
    photo_url: player.photoUrl ?? null,
    rating_history: player.ratingHistory,
    lobby_history: player.lobbyHistory,
    is_mock: true,
  };
}

function mapLobby(lobby) {
  return {
    id: lobby.id,
    title: lobby.title,
    field_name: lobby.fieldName,
    address: lobby.address,
    city: lobby.city,
    datetime: lobby.datetime,
    max_players: lobby.maxPlayers,
    num_teams: lobby.numTeams ?? null,
    players_per_team: lobby.playersPerTeam ?? null,
    min_rating: lobby.minRating ?? null,
    is_private: lobby.isPrivate,
    price: lobby.price ?? null,
    description: lobby.description ?? null,
    created_by: lobby.createdBy,
    distance_km: lobby.distanceKm,
  };
}

function mapMemberships(lobby) {
  const joined = lobby.players.map((player) => ({
    lobby_id: lobby.id,
    profile_id: player.id,
    status: 'joined',
  }));

  const waitlisted = lobby.waitlist.map((player) => ({
    lobby_id: lobby.id,
    profile_id: player.id,
    status: 'waitlisted',
  }));

  return [...joined, ...waitlisted];
}

async function main() {
  const { mockPlayers, mockLobbies } = await loadMockData();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const profiles = mockPlayers.map(mapProfile);
  const lobbies = mockLobbies.map(mapLobby);
  const memberships = mockLobbies.flatMap(mapMemberships);

  const { error: profilesError } = await supabase.from('profiles').upsert(profiles);
  if (profilesError) {
    throw profilesError;
  }

  const { error: lobbiesError } = await supabase.from('lobbies').upsert(lobbies);
  if (lobbiesError) {
    throw lobbiesError;
  }

  const { error: membershipsError } = await supabase
    .from('lobby_memberships')
    .upsert(memberships, { onConflict: 'lobby_id,profile_id' });
  if (membershipsError) {
    throw membershipsError;
  }

  console.log(`Seeded ${profiles.length} profiles, ${lobbies.length} lobbies, and ${memberships.length} memberships.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
