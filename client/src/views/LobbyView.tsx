import React, { useState } from 'react';
import { useGameSocket } from '../context/SocketContext';
import { LogOut, Rocket, UserPlus } from 'lucide-react';

export const LobbyView: React.FC = () => {
  const { createLobby, joinLobby, error, userToken, logout } = useGameSocket();
  
  const [gameId, setGameId] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [action, setAction] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [turnDurationSeconds, setTurnDurationSeconds] = useState(30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameId.trim() || !characterName.trim()) return;

    if (action === 'CREATE') {
      createLobby(gameId.trim(), characterName.trim(), turnDurationSeconds);
    } else {
      joinLobby(gameId.trim(), characterName.trim());
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '500px',
        width: '100%',
        padding: '2.5rem 2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 className="hud-title" style={{ fontSize: '1.4rem' }}>Centrum <span className="hud-accent">Dowodzenia</span></h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Zarejestrowany jako: {userToken?.split('-')[1]}
            </span>
          </div>
          <button onClick={logout} className="btn-futuristic danger" style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
            <LogOut size={14} /> Wyloguj
          </button>
        </div>

        {error && (
          <div className="glass-panel danger" style={{ padding: '0.75rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {/* Zakładki */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button 
            type="button"
            onClick={() => setAction('CREATE')}
            className={`btn-futuristic ${action === 'CREATE' ? '' : 'danger'}`}
            style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem', borderColor: action === 'CREATE' ? 'var(--neon-cyan)' : 'var(--text-muted)', color: action === 'CREATE' ? 'var(--neon-cyan)' : 'var(--text-muted)' }}
          >
            Utwórz grę
          </button>
          <button 
            type="button"
            onClick={() => setAction('JOIN')}
            className={`btn-futuristic ${action === 'JOIN' ? '' : 'danger'}`}
            style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem', borderColor: action === 'JOIN' ? 'var(--neon-cyan)' : 'var(--text-muted)', color: action === 'JOIN' ? 'var(--neon-cyan)' : 'var(--text-muted)' }}
          >
            Dołącz do gry
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
              Identyfikator Pokoju (Lobby ID)
            </label>
            <input
              type="text"
              className="input-futuristic"
              placeholder="np. galaktyka-alpha"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
              Nazwisko Postaci w Grze
            </label>
            <input
              type="text"
              className="input-futuristic"
              placeholder="np. Kapitan Solo"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              required
            />
          </div>
 
          {action === 'CREATE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
                Czas na turę (AFK limit)
              </label>
              <select
                className="input-futuristic"
                value={turnDurationSeconds}
                onChange={(e) => setTurnDurationSeconds(Number(e.target.value))}
                style={{ background: 'var(--bg-dark)', color: 'var(--text-light)', border: '1px solid var(--border-cyan)', cursor: 'pointer', padding: '0.5rem' }}
              >
                <option value={15}>15 sekund (Szybka gra)</option>
                <option value={30}>30 sekund (Standard)</option>
                <option value={60}>60 sekund (Dłuższy namysł)</option>
                <option value={0}>Nielimitowany (Gra towarzyska)</option>
              </select>
            </div>
          )}

          <button type="submit" className="btn-futuristic" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            {action === 'CREATE' ? (
              <>
                <Rocket size={18} /> Inicjuj Kwadrant
              </>
            ) : (
              <>
                <UserPlus size={18} /> Dokuj do Pokoju
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
