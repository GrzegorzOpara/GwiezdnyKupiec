import { Firestore } from '@google-cloud/firestore';
import { User, GameSession, Player, Statek, MarketState } from '../game/game.types';
import { generateInitialConnections } from '../game/utils';

// Inicjalizacja Firestore z uwzględnieniem emulatora
const db = new Firestore({
  projectId: process.env.FIRESTORE_PROJECT_ID || 'gwiezdny-kupiec-dev',
});

if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log(`[Firestore Manager] Uruchamianie w trybie EMULATORA na: ${process.env.FIRESTORE_EMULATOR_HOST}`);
}

// -----------------------------------------------------------------------------
// UŻYTKOWNICY
// -----------------------------------------------------------------------------

export async function saveUser(user: User): Promise<void> {
  await db.collection('users').doc(user.uid).set(user);
  console.log(`[Firestore] Zapisano użytkownika: ${user.displayName} (UID: ${user.uid})`);
}

export async function getUser(uid: string): Promise<User | null> {
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as User;
}

// -----------------------------------------------------------------------------
// SYSTEMY GWIEZDNE I CENY STARTOWE
// -----------------------------------------------------------------------------

export const SYSTEMY_GWIEZDNE = [
  { id: 'mu_herculis', name: 'Mu Herculis' },
  { id: 'tau_ceti', name: 'Tau Ceti' },
  { id: 'beta_hydri', name: 'Beta Hydri' },
  { id: 'epsilon_eridani', name: 'Epsilon Eridani' },
  { id: 'gamma_leporis', name: 'Gamma Leporis' },
  { id: 'sigma_octantis', name: 'Sigma Octantis' }
];

function getInitialMarketState(): Record<string, MarketState> {
  const market: Record<string, MarketState> = {};
  for (const sys of SYSTEMY_GWIEZDNE) {
    market[sys.id] = {
      systemId: sys.id,
      prices: {
        izotopy: 10,
        polimery: 8,
        podzespoly: 12,
        zywnosc: 5
      },
      ppIndicator: {
        izotopy: 0,
        polimery: 0,
        podzespoly: 0,
        zywnosc: 0
      }
    };
  }
  return market;
}

// -----------------------------------------------------------------------------
// POMOCNIKI KREACJI GRACZA/POSTACI
// -----------------------------------------------------------------------------

export function createInitialPlayer(uid: string, characterName: string): Player {
  const startingShip: Statek = {
    id: `ship_${Math.random().toString(36).substr(2, 9)}`,
    nazwa: 'Sokół 1',
    typKadluba: 'Klarnet',
    moduly: ['Towarowy', 'Towarowy', 'Towarowy', 'Pasażerski', 'Lekka broń', 'Bezpieczny skok'],
    klasaZalogi: 'B',
    ladunek: {
      izotopy: 0,
      polimery: 0,
      podzespoly: 0,
      zywnosc: 0
    },
    pasazerowie: [],
    lokacja: {
      systemId: 'mu_herculis',
      obszar: 'PORT'
    },
    uszkodzenia: []
  };

  return {
    uid,
    characterName,
    gotowka: 300, // 300 HT
    reputacja: 20, // 20 Reputacja
    powiazania: generateInitialConnections(),
    dlugBankowy: 0,
    statki: [startingShip],
    magazyny: {},
    fabryki: {}
  };
}

// -----------------------------------------------------------------------------
// SESJE GIER
// -----------------------------------------------------------------------------

export async function createGameSession(sessionId: string, hostUid: string, turnDurationSeconds: number = 30): Promise<GameSession> {
  const session: GameSession = {
    sessionId,
    status: 'LOBBY',
    hostUid,
    currentTurn: 1,
    currentPhase: 1, // Używamy liczby lub GamePhase.LICYTACJA (enum rzutowany na number)
    players: {},
    marketState: getInitialMarketState(),
    turnIntents: {},
    initiativeOrder: [],
    settings: {
      turnDurationSeconds
    },
    createdAt: new Date().toISOString()
  };

  await db.collection('games').doc(sessionId).set(session);
  console.log(`[Firestore] Utworzono nową grę: ${sessionId} przez hosta (UID: ${hostUid})`);
  return session;
}

export async function getGameSession(sessionId: string): Promise<GameSession | null> {
  const doc = await db.collection('games').doc(sessionId).get();
  if (!doc.exists) return null;
  return doc.data() as GameSession;
}

export async function saveGameSession(session: GameSession): Promise<void> {
  await db.collection('games').doc(session.sessionId).set(session);
  console.log(`[Firestore] Zapisano grę: ${session.sessionId} (status: ${session.status})`);
}

export async function getActiveSessions(): Promise<GameSession[]> {
  const snapshot = await db.collection('games')
    .where('status', '==', 'LOBBY')
    .get();

  const sessions: GameSession[] = [];
  snapshot.forEach(doc => {
    sessions.push(doc.data() as GameSession);
  });
  return sessions;
}

export { db };
