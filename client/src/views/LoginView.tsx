import React from 'react';
import { useGameSocket } from '../context/SocketContext';
import { Shield } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, error } = useGameSocket();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '450px',
        width: '100%',
        textAlign: 'center',
        padding: '2.5rem 2rem'
      }}>
        <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(0,243,255,0.05)', borderRadius: '50%', marginBottom: '1.5rem', border: '1px solid var(--border-cyan)' }}>
          <Shield size={42} className="hud-accent" />
        </div>
        
        <h1 className="hud-title" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          GWIEZDNY <span className="hud-accent">KUPIEC</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Autoryzacja Konsoli Handlowej
        </p>

        {error && (
          <div className="glass-panel danger" style={{ padding: '0.75rem', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'left' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button 
            type="button" 
            onClick={() => login('Grzegorz Opara')} 
            className="btn-futuristic" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            Zaloguj przez Google (Grzegorz Opara)
          </button>

          <button 
            type="button" 
            onClick={() => login('Drugi Gracz (Test)')} 
            className="btn-futuristic danger" 
            style={{ width: '100%', fontSize: '0.75rem' }}
          >
            Zaloguj jako Drugi Gracz (do testów na 2 oknach)
          </button>
        </div>
      </div>
    </div>
  );
};
