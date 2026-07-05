import { Server, Socket } from 'socket.io';
import { getGameSession, saveGameSession } from '../db/firestore';
import { GameSession, PlayerTurnIntent, GamePhase } from '../game/game.types';
import { progressToNextPhase, resumeFromCombatPhase } from '../game/engine';

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
    // Resetujemy turnIntents i gotowość (isSubmitted) przed rozpoczęciem nowej fazy interaktywnej
    session.turnIntents = {};
    for (const uid of Object.keys(session.players)) {
      session.turnIntents[uid] = { 
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

    const durationSeconds = getPhaseDuration(session.currentPhase, session.settings?.turnDurationSeconds);
    
    if (durationSeconds > 0) {
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
      // Czas nielimitowany - usuwamy ewentualny phaseEndTimeMs
      if (session.phaseEndTimeMs !== undefined) {
        delete session.phaseEndTimeMs;
      }
      await saveGameSession(session);

      io.to(session.sessionId).emit('game:phaseStarted', {
        phase: session.currentPhase,
        session
      });
    }
  } else {
    io.to(session.sessionId).emit('game:state', session);
  }
}

function getPhaseDuration(phase: number, baseDuration?: number): number {
  const duration = (baseDuration !== undefined && baseDuration !== null) ? baseDuration : 30;
  if (duration === 0) return 0; // Infinite timer
  
  switch (phase) {
    case GamePhase.LICYTACJA: return Math.max(10, Math.ceil(duration * 0.5)); // Bidding - krótko (50% bazy)
    case GamePhase.HIPERSKOKI: return Math.max(10, Math.ceil(duration * 0.8)); // Hiperskoki - średnio (80% bazy)
    case GamePhase.TRANSAKCJE: return Math.max(20, Math.ceil(duration * 1.5)); // Transakcje - najdłużej (150% bazy)
    case GamePhase.INWESTYCJE: return Math.max(15, Math.ceil(duration * 1.2)); // Inwestycje - średnio-długo (120% bazy)
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

  // Gracz podejmuje decyzję o walce
  socket.on('game:combatDecision', async (data: { sessionId: string; decision: 'WALKA' | 'UCIECZKA' | 'PODDANIE' }) => {
    try {
      const { sessionId, decision } = data;
      const session = await getGameSession(sessionId);
      if (!session) return socket.emit('game:error', { message: 'Sesja nie istnieje' });

      if (session.status !== 'COMBAT_PAUSE') {
        return socket.emit('game:error', { message: 'Gra nie jest w fazie walki' });
      }

      console.log(`[Combat] Gracz ${user.uid} podjął decyzję: ${decision} w sesji ${sessionId}`);

      // Wznawiamy grę z poziomu walki
      resumeFromCombatPhase(session);
      await saveGameSession(session);

      // Uruchamiamy cykl dla Fazy 5 (Transakcje)
      await runGameLifecycle(io, session);

    } catch (error: any) {
      socket.emit('game:error', { message: error.message });
    }
  });

  // Transfer towarów: Magazyn <-> Ładownia Statku
  socket.on('game:transferCargo', async (data: { 
    sessionId: string; 
    shipId: string; 
    commodity: TowarId; 
    amount: number; // dodatnie = załadunek na statek, ujemne = wyładunek do magazynu
  }) => {
    try {
      const { sessionId, shipId, commodity, amount } = data;
      if (amount === 0) return;

      const session = await getGameSession(sessionId);
      if (!session) return socket.emit('game:error', { message: 'Sesja nie istnieje' });

      const player = session.players[user.uid];
      if (!player) return socket.emit('game:error', { message: 'Nie jesteś uczestnikiem tej gry' });

      const ship = player.statki.find(s => s.id === shipId);
      if (!ship) return socket.emit('game:error', { message: 'Nie znaleziono statku o podanym ID' });

      // Walidacja lokacji (tylko PORT lub PLANETA)
      if (ship.lokacja.obszar !== 'PORT' && ship.lokacja.obszar !== 'PLANETA') {
        return socket.emit('game:error', { message: 'Statek musi znajdować się w porcie lub na planecie, aby dokonać przeładunku' });
      }

      const systemId = ship.lokacja.systemId;

      // Oblicz pojemność statku (wg modułów towarowych)
      const maxCargoCapacity = ship.moduly.filter(m => 
        m.toLowerCase().includes('towarowy') || 
        m.toLowerCase().includes('ładun') || 
        m.toLowerCase().includes('kontener')
      ).length;

      const currentCargoCount = Object.values(ship.ladunek).reduce((sum, v) => sum + v, 0);

      // Inicjalizacja magazynu w tym układzie, jeśli go nie ma
      if (!player.magazyny[systemId]) {
        player.magazyny[systemId] = { izotopy: 0, polimery: 0, podzespoly: 0, zywnosc: 0 };
      }

      if (amount > 0) {
        // Załadunek na statek
        const availableInWarehouse = player.magazyny[systemId][commodity] || 0;
        if (availableInWarehouse < amount) {
          return socket.emit('game:error', { message: `Brak towaru w magazynie ${systemId.toUpperCase()} (Posiadasz: ${availableInWarehouse}, Chcesz załadować: ${amount})` });
        }

        if (currentCargoCount + amount > maxCargoCapacity) {
          return socket.emit('game:error', { message: `Ładownia statku przepełniona! Wolne miejsce: ${maxCargoCapacity - currentCargoCount}, Chcesz załadować: ${amount}` });
        }

        player.magazyny[systemId][commodity] -= amount;
        ship.ladunek[commodity] = (ship.ladunek[commodity] || 0) + amount;
        console.log(`[Cargo] Gracz ${player.characterName} załadował ${amount}x ${commodity} na statek ${ship.nazwa} w ${systemId}`);

      } else {
        // Wyładunek do magazynu (amount jest ujemne!)
        const absAmount = Math.abs(amount);
        const availableOnShip = ship.ladunek[commodity] || 0;
        if (availableOnShip < absAmount) {
          return socket.emit('game:error', { message: `Brak towaru na statku (Posiada: ${availableOnShip}, Chcesz wyładować: ${absAmount})` });
        }

        ship.ladunek[commodity] -= absAmount;
        player.magazyny[systemId][commodity] += absAmount;
        console.log(`[Cargo] Gracz ${player.characterName} wyładował ${absAmount}x ${commodity} ze statku ${ship.nazwa} do magazynu w ${systemId}`);
      }

      await saveGameSession(session);
      io.to(sessionId).emit('game:state', session);

    } catch (error: any) {
      socket.emit('game:error', { message: error.message });
    }
  });
}
