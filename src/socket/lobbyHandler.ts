import { Server, Socket } from 'socket.io';
import { 
  getActiveSessions, 
  getGameSession, 
  createGameSession, 
  saveGameSession, 
  createInitialPlayer 
} from '../db/firestore';
import { runGameLifecycle } from './gameHandler';

export function registerLobbyHandlers(io: Server, socket: Socket) {
  const user = (socket as any).user;

  socket.on('lobby:list', async () => {
    try {
      const activeSessions = await getActiveSessions();
      const mappedSessions = activeSessions.map(s => ({
        sessionId: s.sessionId,
        hostUid: s.hostUid,
        playersCount: Object.keys(s.players).length,
        playersNames: Object.values(s.players).map(p => p.characterName),
        createdAt: s.createdAt
      }));
      socket.emit('lobby:list:response', { success: true, lobbies: mappedSessions });
    } catch (error: any) {
      socket.emit('lobby:error', { message: 'Nie udało się pobrać listy lobby: ' + error.message });
    }
  });

  socket.on('lobby:create', async (data: { sessionId: string; characterName: string; turnDurationSeconds?: number }) => {
    try {
      const { sessionId, characterName, turnDurationSeconds } = data;
      if (!sessionId || !characterName) {
        return socket.emit('lobby:error', { message: 'ID sesji oraz nazwa postaci są wymagane.' });
      }

      const existing = await getGameSession(sessionId);
      if (existing) {
        return socket.emit('lobby:error', { message: `Sesja gry o ID '${sessionId}' już istnieje.` });
      }

      const turnDuration = turnDurationSeconds !== undefined ? turnDurationSeconds : 30; // Domyślnie 30s
      const session = await createGameSession(sessionId, user.uid, turnDuration);
      const player = createInitialPlayer(user.uid, characterName);
      session.players[user.uid] = player;
      
      await saveGameSession(session);

      socket.join(sessionId);
      socket.emit('lobby:joined', { success: true, session });
      console.log(`[Lobby] Gracz ${characterName} (UID: ${user.uid}) stworzył i dołączył do gry: ${sessionId}`);
    } catch (error: any) {
      socket.emit('lobby:error', { message: 'Nie udało się stworzyć gry: ' + error.message });
    }
  });

  socket.on('lobby:join', async (data: { sessionId: string; characterName: string }) => {
    try {
      const { sessionId, characterName } = data;
      if (!sessionId || !characterName) {
        return socket.emit('lobby:error', { message: 'ID sesji oraz nazwa postaci są wymagane.' });
      }

      const session = await getGameSession(sessionId);
      if (!session) {
        return socket.emit('lobby:error', { message: `Sesja gry o ID '${sessionId}' nie istnieje.` });
      }

      if (session.status !== 'LOBBY') {
        return socket.emit('lobby:error', { message: 'Ta gra już się rozpoczęła lub zakończyła.' });
      }

      const playersCount = Object.keys(session.players).length;
      if (playersCount >= 6) {
        return socket.emit('lobby:error', { message: 'Ta gra jest już pełna (maksymalnie 6 graczy).' });
      }

      const player = createInitialPlayer(user.uid, characterName);
      session.players[user.uid] = player;

      await saveGameSession(session);

      socket.join(sessionId);
      socket.emit('lobby:joined', { success: true, session });
      
      io.to(sessionId).emit('lobby:updated', { session });
      console.log(`[Lobby] Gracz ${characterName} (UID: ${user.uid}) dołączył do gry: ${sessionId}`);
    } catch (error: any) {
      socket.emit('lobby:error', { message: 'Nie udało się dołączyć do gry: ' + error.message });
    }
  });

  socket.on('lobby:start', async (data: { sessionId: string }) => {
    try {
      const { sessionId } = data;
      if (!sessionId) {
        return socket.emit('lobby:error', { message: 'ID sesji jest wymagane.' });
      }

      const session = await getGameSession(sessionId);
      if (!session) {
        return socket.emit('lobby:error', { message: `Sesja gry o ID '${sessionId}' nie istnieje.` });
      }

      if (session.hostUid !== user.uid) {
        return socket.emit('lobby:error', { message: 'Tylko założyciel gry (host) może ją rozpocząć.' });
      }

      if (session.status !== 'LOBBY') {
        return socket.emit('lobby:error', { message: 'Gra została już uruchomiona.' });
      }

      session.status = 'ACTIVE';
      await saveGameSession(session);

      io.to(sessionId).emit('game:started', { session });
      console.log(`[Lobby] Host rozpoczął grę: ${sessionId}`);
      
      await runGameLifecycle(io, session);
    } catch (error: any) {
      socket.emit('lobby:error', { message: 'Nie udało się rozpocząć gry: ' + error.message });
    }
  });
}
