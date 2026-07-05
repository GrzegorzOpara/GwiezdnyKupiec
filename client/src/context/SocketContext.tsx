import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameSession } from '../types/game.types'; // lokalna kopia typów dla kontenera client

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  gameState: GameSession | null;
  error: string | null;
  userToken: string | null;
  characterName: string | null;
  login: (nickname: string) => void;
  logout: () => void;
  createLobby: (sessionId: string, characterName: string, turnDurationSeconds?: number) => void;
  joinLobby: (sessionId: string, characterName: string) => void;
  startGame: (sessionId: string) => void;
  submitTurnIntent: (sessionId: string, intent: any) => void;
  submitCombatDecision: (sessionId: string, decision: 'WALKA' | 'UCIECZKA' | 'PODDANIE') => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(localStorage.getItem('gt_user_token'));
  const [characterName, setCharacterName] = useState<string | null>(localStorage.getItem('gt_char_name'));

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  useEffect(() => {
    if (!userToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      return;
    }

    // Łączymy się z tokenem auth
    const newSocket = io(BACKEND_URL, {
      auth: {
        token: userToken // przekazujemy token do weryfikacji auth
      },
      reconnectionAttempts: 5,
      timeout: 10000
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('[Socket] Połączono z serwerem gry');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket] Rozłączono z serwerem');
    });

    newSocket.on('connect_error', (err) => {
      setError(`Błąd połączenia z serwerem: ${err.message}`);
      setIsConnected(false);
    });

    // Odbieranie stanu gry
    newSocket.on('game:state', (state: GameSession) => {
      setGameState(state);
      console.log('[Socket] Otrzymano nowy stan gry:', state);
    });

    newSocket.on('lobby:updated', (data: { session: GameSession }) => {
      setGameState(data.session);
      console.log('[Socket] Lobby zaktualizowane:', data.session);
    });

    newSocket.on('game:started', (data: { session: GameSession }) => {
      setGameState(data.session);
      console.log('[Socket] Gra rozpoczęta:', data.session);
    });

    newSocket.on('game:phaseStarted', (data: { phase: number; phaseEndTimeMs?: number; session: GameSession }) => {
      setGameState(data.session);
      console.log('[Socket] Rozpoczęto nową fazę:', data.phase, data.session);
    });

    newSocket.on('game:phaseResults', (data: { session: GameSession; logs: string[] }) => {
      setGameState(data.session);
      console.log('[Socket] Koniec fazy. Logi:', data.logs);
    });

    newSocket.on('lobby:joined', (data: { success: boolean; session: GameSession }) => {
      setGameState(data.session);
      setError(null);
    });

    newSocket.on('lobby:error', (data: { message: string }) => {
      setError(data.message);
    });

    newSocket.on('game:error', (data: { message: string }) => {
      setError(data.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userToken]);

  const login = (nickname: string) => {
    // Generujemy prosty token udający auth (musi startować od 'test-token-' dla bypassu w middleware)
    const token = `test-token-${nickname}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('gt_user_token', token);
    setUserToken(token);
  };

  const logout = () => {
    localStorage.removeItem('gt_user_token');
    localStorage.removeItem('gt_char_name');
    setUserToken(null);
    setCharacterName(null);
    setGameState(null);
  };

  const createLobby = (sessionId: string, charName: string, turnDurationSeconds?: number) => {
    localStorage.setItem('gt_char_name', charName);
    setCharacterName(charName);
    socket?.emit('lobby:create', { sessionId, characterName: charName, turnDurationSeconds });
  };

  const joinLobby = (sessionId: string, charName: string) => {
    localStorage.setItem('gt_char_name', charName);
    setCharacterName(charName);
    socket?.emit('lobby:join', { sessionId, characterName: charName });
  };

  const startGame = (sessionId: string) => {
    socket?.emit('lobby:start', { sessionId });
  };

  const submitTurnIntent = (sessionId: string, intent: any) => {
    socket?.emit('game:submitOrder', { sessionId, intent });
  };

  const submitCombatDecision = (sessionId: string, decision: 'WALKA' | 'UCIECZKA' | 'PODDANIE') => {
    socket?.emit('game:combatDecision', { sessionId, decision });
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        gameState,
        error,
        userToken,
        characterName,
        login,
        logout,
        createLobby,
        joinLobby,
        startGame,
        submitTurnIntent,
        submitCombatDecision
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useGameSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useGameSocket musi być użyte wewnątrz SocketProvider');
  return context;
};
