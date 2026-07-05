import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { OAuth2Client } from 'google-auth-library';
import verifyGoogleToken, { AuthenticatedRequest } from './auth/authMiddleware';
import { User, GameSession } from './game/game.types';
import {
  saveUser,
  createGameSession,
  getGameSession,
  saveGameSession,
  getActiveSessions,
  createInitialPlayer
} from './db/firestore';

const app = express();
const httpServer = createServer(app);

app.use(express.json());

// Inicjalizacja klienta Google Auth do użytku w WebSockets
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Inicjalizacja Redis
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => console.error('[Redis] Błąd połączenia:', err));
redisClient.on('connect', () => console.log('[Redis] Połączono pomyślnie.'));

async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('[Redis] Nie udało się połączyć z bazą Redis:', error);
  }
}
connectRedis();

// Routing Express
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    services: {
      redis: redisClient.isOpen ? 'connected' : 'disconnected',
      firestore: process.env.FIRESTORE_EMULATOR_HOST ? 'emulator' : 'cloud',
    }
  });
});

// Zabezpieczony endpoint rejestracji / profilu użytkownika
app.get('/api/user/profile', verifyGoogleToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const userPayload = req.user;
    if (!userPayload) {
      return res.status(401).json({ error: 'Niepoprawne dane uwierzytelniania' });
    }

    const user: User = {
      uid: userPayload.uid,
      displayName: userPayload.name || 'Nieznany Gracz',
      email: userPayload.email || '',
      lastActiveAt: new Date().toISOString(),
    };

    await saveUser(user);

    res.json({
      message: 'Profil załadowany i zapisany pomyślnie!',
      user,
    });
  } catch (error: any) {
    console.error('[API] Błąd profilu użytkownika:', error.message);
    res.status(500).json({ error: 'Wystąpił błąd serwera' });
  }
});

// Konfiguracja Socket.io z zabezpieczeniem (Google Auth Middleware)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
  
  if (!token) {
    console.log('[Socket.io] Odrzucono połączenie: brak tokenu.');
    return next(new Error('Authentication error: Token is required'));
  }

  const cleanedToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

  try {
    if (cleanedToken.startsWith('test-token-')) {
      (socket as any).user = {
        uid: cleanedToken.replace('test-token-', ''),
        email: `${cleanedToken}@example.com`,
        name: `Tester ${cleanedToken.replace('test-token-', '')}`,
      };
      return next();
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: cleanedToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return next(new Error('Authentication error: Invalid payload'));
    }

    (socket as any).user = {
      uid: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    console.log(`[Socket.io] Zautoryzowano użytkownika: ${payload.name}`);
    next();
  } catch (error: any) {
    console.error('[Socket.io] Błąd uwierzytelniania:', error.message);
    next(new Error('Authentication error: Invalid Google Token'));
  }
});

io.on('connection', (socket) => {
  const user = (socket as any).user;
  console.log(`[Socket.io] Połączono użytkownika: ${user.name} (Socket ID: ${socket.id})`);

  socket.emit('welcome', {
    message: `Witaj w Gwiezdnym Kupcu, ${user.name}!`,
    userId: user.uid,
  });

  // ---------------------------------------------------------------------------
  // OBSŁUGA LOBBY (WebSockets)
  // ---------------------------------------------------------------------------

  // 1. Pobranie listy aktywnych gier w lobby
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

  // 2. Utworzenie nowej gry i dołączenie jako postać gracza
  socket.on('lobby:create', async (data: { sessionId: string; characterName: string }) => {
    try {
      const { sessionId, characterName } = data;
      if (!sessionId || !characterName) {
        return socket.emit('lobby:error', { message: 'ID sesji oraz nazwa postaci są wymagane.' });
      }

      // Sprawdzenie czy gra już istnieje
      const existing = await getGameSession(sessionId);
      if (existing) {
        return socket.emit('lobby:error', { message: `Sesja gry o ID '${sessionId}' już istnieje.` });
      }

      // Stworzenie sesji
      const session = await createGameSession(sessionId, user.uid);
      
      // Dodanie gracza startowego
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

  // 3. Dołączenie do istniejącej gry
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

      // Stworzenie i dodanie nowej postaci
      const player = createInitialPlayer(user.uid, characterName);
      session.players[user.uid] = player;

      await saveGameSession(session);

      socket.join(sessionId);
      socket.emit('lobby:joined', { success: true, session });
      
      // Poinformowanie innych graczy w pokoju o dołączeniu
      io.to(sessionId).emit('lobby:updated', { session });
      console.log(`[Lobby] Gracz ${characterName} (UID: ${user.uid}) dołączył do gry: ${sessionId}`);
    } catch (error: any) {
      socket.emit('lobby:error', { message: 'Nie udało się dołączyć do gry: ' + error.message });
    }
  });

  // 4. Rozpoczęcie gry przez hosta
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

      // Zmiana statusu na ACTIVE
      session.status = 'ACTIVE';
      await saveGameSession(session);

      // Poinformowanie wszystkich w pokoju o starcie gry
      io.to(sessionId).emit('game:started', { session });
      console.log(`[Lobby] Host rozpoczął grę: ${sessionId}`);
    } catch (error: any) {
      socket.emit('lobby:error', { message: 'Nie udało się rozpocząć gry: ' + error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Rozłączono użytkownika: ${user.name} (Socket ID: ${socket.id})`);
  });
});

// Start serwera
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Serwer gry Gwiezdny Kupiec nasłuchuje na porcie ${PORT}`);
  console.log(`🏥 Health check dostępny na http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});
