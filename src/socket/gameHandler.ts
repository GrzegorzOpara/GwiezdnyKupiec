import { Server, Socket } from 'socket.io';
import { getGameSession, saveGameSession } from '../db/firestore';
import { GameSession, PlayerTurnIntent, GamePhase } from '../game/game.types';
import { progressToNextPhase } from '../game/engine';

// Mapa przechowująca aktywne timery dla każdej sesji gry
export const activeTimers: Record<string, NodeJS.Timeout> = {};

/**
 * Główna pętla cyklu życia gry, sterująca automatycznymi przejściami faz deweloperskich/AFK
 */
export async function runGameLifecycle(io: Server, session: GameSession): Promise<void> {
  // Czyścimy stary timer jeśli istnieje
  if (activeTimers[session.sessionId]) {
    clearTimeout(activeTimers[session.sessionId]);
    delete activeTimers[session.sessionId];
  }

  // Automatycznie rozstrzygamy fazy natychmiastowe (bez wejścia gracza)
  let needsInput = false;
  while (!needsInput && session.status === 'ACTIVE') {
    const phase = session.currentPhase;
    if (
      phase === GamePhase.LICYTACJA ||
      phase === GamePhase.HIPERSKOKI ||
      phase === GamePhase.TRANSAKCJE ||
      phase === GamePhase.INWESTYCJE
    ) {
      needsInput = true;
      break;
    }

    // Wykonujemy krok maszyny stanów
    progressToNextPhase(session);
  }

  // Obsługa pauzy bojowej lub końca gry
  if (session.status === 'COMBAT_PAUSE' || session.status === 'FINISHED') {
    io.to(session.sessionId).emit('game:state', session);
    return;
  }

  if (needsInput) {
    const durationSeconds = getPhaseDuration(session.currentPhase);
    session.phaseEndTimeMs = Date.now() + durationSeconds * 1000;
    await saveGameSession(session);

    // Rozsyłamy status do pokoju
    io.to(session.sessionId).emit('game:phaseStarted', {
      phase: session.currentPhase,
      phaseEndTimeMs: session.phaseEndTimeMs,
      session
    });

    // Rejestrujemy stoper bezpieczeństwa (AFK)
    activeTimers[session.sessionId] = setTimeout(async () => {
      try {
        const updatedSession = await getGameSession(session.sessionId);
        if (updatedSession && updatedSession.status === 'ACTIVE' && updatedSession.currentPhase === session.currentPhase) {
          console.log(`[Timer] Czas minął dla Fazy ${updatedSession.currentPhase} w sesji ${updatedSession.sessionId}. Auto-resolve.`);
          progressToNextPhase(updatedSession);
          delete updatedSession.phaseEndTimeMs;
          await saveGameSession(updatedSession);
          
          // Uruchamiamy cykl dla kolejnej fazy
          await runGameLifecycle(io, updatedSession);
        }
      } catch (err) {
        console.error('[Timer] Błąd stopera fazy:', err);
      }
    }, durationSeconds * 1000);
  } else {
    io.to(session.sessionId).emit('game:state', session);
  }
}

function getPhaseDuration(phase: number): number {
  switch (phase) {
    case GamePhase.LICYTACJA: return 20;   // 20 sekund
    case GamePhase.HIPERSKOKI: return 30;   // 30 sekund
    case GamePhase.TRANSAKCJE: return 40;   // 40 sekund
    case GamePhase.INWESTYCJE: return 30;   // 30 sekund
    default: return 0;
  }
}

export function registerGameHandlers(io: Server, socket: Socket) {
  const user = (socket as any).user;

  // Gracz zatwierdza swoje akcje w danej fazie
  socket.on('game:submitOrder', async (data: { sessionId: string; intent: PlayerTurnIntent }) => {
    try {
      const { sessionId, intent } = data;
      const session = await getGameSession(sessionId);
      if (!session) return socket.emit('game:error', { message: 'Sesja nie istnieje' });

      if (session.status !== 'ACTIVE') {
        return socket.emit('game:error', { message: 'Gra nie jest aktywna' });
      }

      if (session.phaseEndTimeMs && Date.now() > session.phaseEndTimeMs) {
        return socket.emit('game:error', { message: 'Czas na deklaracje w tej fazie minął!' });
      }

      if (!session.turnIntents[user.uid]) {
        session.turnIntents[user.uid] = { 
          initiativeBidHT: 0, 
          offers: [], 
          shipMoves: [], 
          shipPurchases: [], 
          factoryPurchases: [],
          loanRequests: 0,
          loanRepayments: 0,
          loadPassengers: [],
          isSubmitted: false 
        };
      }
      
      session.turnIntents[user.uid] = {
        ...intent,
        isSubmitted: true
      };

      const allPlayers = Object.keys(session.players);
      const allReady = allPlayers.every(uid => {
        const playerIntent = session.turnIntents[uid];
        return playerIntent && playerIntent.isSubmitted;
      });

      if (allReady) {
        // Wszyscy gotowi - kasujemy stoper
        if (activeTimers[sessionId]) {
          clearTimeout(activeTimers[sessionId]);
          delete activeTimers[sessionId];
        }

        progressToNextPhase(session);
        delete session.phaseEndTimeMs;
        await saveGameSession(session);

        console.log(`[Engine] Wszyscy gotowi. Auto-progres sesji ${sessionId} do Fazy ${session.currentPhase}`);
        
        // Puszczamy cykl dalej (może przejść przez kolejne fazy automatyczne)
        await runGameLifecycle(io, session);
      } else {
        await saveGameSession(session);
        socket.emit('game:orderReceived', { success: true });
        io.to(sessionId).emit('game:playerReady', { uid: user.uid });
      }

    } catch (error: any) {
      socket.emit('game:error', { message: error.message });
    }
  });

  // Host ręcznie rozpoczyna odliczanie fazy
  socket.on('game:startPhase', async (data: { sessionId: string; durationSeconds: number }) => {
    try {
      const { sessionId, durationSeconds } = data;
      const session = await getGameSession(sessionId);
      if (!session) return socket.emit('game:error', { message: 'Sesja nie istnieje' });

      if (session.hostUid !== user.uid) {
        return socket.emit('game:error', { message: 'Tylko host może sterować czasem' });
      }

      // Kasujemy stary timer jeśli istnieje
      if (activeTimers[sessionId]) {
        clearTimeout(activeTimers[sessionId]);
      }

      // Ustawiamy koniec fazy
      const durationMs = durationSeconds * 1000;
      session.phaseEndTimeMs = Date.now() + durationMs;
      await saveGameSession(session);

      io.to(sessionId).emit('game:phaseStarted', { 
        phase: session.currentPhase, 
        phaseEndTimeMs: session.phaseEndTimeMs 
      });

      // Uruchamiamy odliczanie na serwerze
      activeTimers[sessionId] = setTimeout(async () => {
        try {
          const updatedSession = await getGameSession(sessionId);
          if (updatedSession) {
            // Czas minął - puszczamy machinę stanów dalej
            progressToNextPhase(updatedSession);
            delete updatedSession.phaseEndTimeMs; // kasujemy licznik używając delete (Firestore nie wspiera undefined)

            await saveGameSession(updatedSession);

            io.to(sessionId).emit('game:phaseResults', {
              session: updatedSession
            });
          }
        } catch (err) {
          console.error(`[Engine] Błąd podczas automatycznego przejścia fazy:`, err);
        }
      }, durationMs);

    } catch (error: any) {
      socket.emit('game:error', { message: error.message });
    }
  });
}
