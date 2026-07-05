import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { Firestore } from '@google-cloud/firestore';
import { OAuth2Client } from 'google-auth-library';
import verifyGoogleToken, { AuthenticatedRequest } from './auth/authMiddleware';

const app = express();
const httpServer = createServer(app);

app.use(express.json());

// Inicjalizacja klienta Google Auth do użytku w WebSockets
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 1. Inicjalizacja Firestore (w tym wsparcie dla Emulatora)
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log(`[Firestore] Uruchamianie w trybie EMULATORA na: ${process.env.FIRESTORE_EMULATOR_HOST}`);
}
const db = new Firestore({
  projectId: process.env.FIRESTORE_PROJECT_ID || 'gwiezdny-kupiec-dev',
});

// 2. Inicjalizacja Redis
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

// 3. Routing Express
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

// Zabezpieczony endpoint testowy
app.get('/api/user/profile', verifyGoogleToken as any, (req: AuthenticatedRequest, res) => {
  res.json({
    message: 'Dostęp autoryzowany pomyślnie!',
    user: req.user,
  });
});

// 4. Konfiguracja Socket.io z zabezpieczeniem (Google Auth Middleware)
const io = new Server(httpServer, {
  cors: {
    origin: '*', // W środowisku produkcyjnym należy ograniczyć do konkretnej domeny
    methods: ['GET', 'POST']
  }
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
  
  if (!token) {
    console.log('[Socket.io] Odrzucono połączenie: brak tokenu.');
    return next(new Error('Authentication error: Token is required'));
  }

  // Wyodrębnienie samego tokenu jeśli przekazano jako "Bearer <token>"
  const cleanedToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

  try {
    // Ułatwienie testowe
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
  console.log(`[Socket.io] Połączono gracza: ${user.name} (Socket ID: ${socket.id})`);

  socket.emit('welcome', {
    message: `Witaj w Gwiezdnym Kupcu, ${user.name}!`,
    userId: user.uid,
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Rozłączono gracza: ${user.name} (Socket ID: ${socket.id})`);
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
