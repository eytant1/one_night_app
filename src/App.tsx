import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CharacterEditor } from './pages/CharacterEditor';
import { GamePage } from './pages/GamePage';
import { GamesList } from './pages/GamesList';
import { LineupEditor } from './pages/LineupEditor';
import { NightPlayer } from './pages/NightPlayer';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GamesList />} />
        <Route path="/game/:gameId" element={<Navigate to="characters" replace />} />
        <Route path="/game/:gameId/:tab" element={<GamePage />} />
        <Route path="/game/:gameId/character/:characterId" element={<CharacterEditor />} />
        <Route path="/game/:gameId/lineup/:lineupId" element={<LineupEditor />} />
        <Route path="/game/:gameId/night/:lineupId" element={<NightPlayer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
