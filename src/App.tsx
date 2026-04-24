import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { AppPreferencesProvider } from './contexts/AppPreferencesContext';
import { AuthProvider } from './contexts/SupabaseAuthContext';
import AppShell from './components/AppShell';
import Home from './pages/HomeLive';
import LobbyDetail from './pages/LobbyDetailLive';
import CreateLobby from './pages/CreateLobbyPage';
import EditLobby from './pages/EditLobbyPage';
import Register from './pages/RegisterPage';
import Login from './pages/LoginLive';
import Profile from './pages/ProfileLive';
import ProfileFriendsPage from './pages/ProfileFriendsPage';
import ProfileHistoryPage from './pages/ProfileHistoryPage';
import EditProfile from './pages/EditProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import MyNetworkPage from './pages/MyNetworkPage';
import RafflesPage from './pages/RafflesPage';
import LeaderboardsPage from './pages/LeaderboardsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <AppPreferencesProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text)]">
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/network" element={<MyNetworkPage />} />
                  <Route path="/create" element={<CreateLobby />} />
                  <Route path="/raffles" element={<RafflesPage />} />
                  <Route path="/leaderboards" element={<LeaderboardsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/lobby/:id" element={<LobbyDetail />} />
                  <Route path="/lobby/:id/edit" element={<EditLobby />} />
                  <Route path="/profile/:id" element={<Profile />} />
                  <Route path="/profile/:id/friends" element={<ProfileFriendsPage />} />
                  <Route path="/profile/:id/history" element={<ProfileHistoryPage />} />
                  <Route path="/profile/:id/edit" element={<EditProfile />} />
                </Route>
                <Route path="/register" element={<Register />} />
                <Route path="/login" element={<Login />} />
              </Routes>
            </div>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </AppPreferencesProvider>
  );
}
