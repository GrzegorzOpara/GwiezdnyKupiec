import { Server, Socket } from 'socket.io';
import { getGameSession, saveGameSession } from '../db/firestore';
import { GameSession, PlayerTurnIntent } from '../game/game.types';
import { progressToNextPhase } from '../game/engine';

// Mapa przechowująca aktywne timery dla każdej sesji gry
const activeTimers: Record<string, NodeJS.Timeout> = {};

export function registerGameHandlers(io: Server, socket: Socket) {
  const user = (socket as any).user;

  // Gracz zatwierdza swoje akcje w danej fazie
  socket.on('game:submitOrder', async (data: { sessionId: string; intent: PlayerTurnIntent }) => {
    try {
      const { sessionId, intent } = data;
      const session = await getGameSession(sessionId);
      if (!session) return socket.emit('game:error', { message: 'Sesja nie istnieje' });

      // Sprawdzenie czy gra jest aktywna
      if (session.status !== 'ACTIVE') {
        return socket.emit('game:error', { message: 'Gra nie jest aktywna' });
      }

      // Sprawdzenie czy czas fazy nie minął
      if (session.phaseEndTimeMs && Date.now() > session.phaseEndTimeMs) {
        return socket.emit('game:error', { message: 'Czas na deklaracje w tej fazie minął!' });
      }

      // Zapisujemy intencje gracza do bufora
      if (!session.turnIntents[user.uid]) {
        session.turnIntents[user.uid] = { initiativeBidHT: 0, offers: [], isSubmitted: false };
      }
      
      session.turnIntents[user.uid] = {
        ...intent,
        isSubmitted: true
      };

      await saveGameSession(session);
      socket.emit('game:orderReceived', { success: true });
      
      // Powiadamiamy innych w pokoju, że gracz zgłosił gotowość (bez ujawniania jego ofert)
      io.to(sessionId).emit('game:playerReady', { uid: user.uid });

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
