import { describe, it, expect, beforeAll } from 'vitest';

let firestoreModule: typeof import('./firestore');

beforeAll(async () => {
  // Ustawienie zmiennych środowiskowych przed załadowaniem modułu (zapobiega ESM hoisting bug)
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIRESTORE_PROJECT_ID = 'gwiezdny-kupiec-dev';
  
  firestoreModule = await import('./firestore');
});

describe('Integracja z Firestore (Emulator)', () => {
  describe('Zarządzanie Użytkownikami', () => {
    it('powinien zapisać i poprawnie pobrać profil użytkownika', async () => {
      const { saveUser, getUser } = firestoreModule;
      const testUid = `user_test_${Math.random().toString(36).substr(2, 9)}`;
      const testUser = {
        uid: testUid,
        displayName: 'Jan Kowalski',
        email: 'jan@example.com',
        lastActiveAt: new Date().toISOString()
      };

      // Zapis
      await saveUser(testUser);

      // Pobranie
      const fetched = await getUser(testUid);
      expect(fetched).not.toBeNull();
      expect(fetched?.uid).toBe(testUser.uid);
      expect(fetched?.displayName).toBe(testUser.displayName);
      expect(fetched?.email).toBe(testUser.email);
    });

    it('powinien zwrócić null dla nieistniejącego użytkownika', async () => {
      const { getUser } = firestoreModule;
      const fetched = await getUser('nieistniejacy_uid');
      expect(fetched).toBeNull();
    });
  });

  describe('Zarządzanie Sesjami Gry i Graczami', () => {
    it('powinien utworzyć nową sesję gry z domyślnymi wartościami', async () => {
      const { createGameSession, getGameSession } = firestoreModule;
      const testSessionId = `game_test_${Math.random().toString(36).substr(2, 9)}`;
      const hostUid = 'host_123';

      // Tworzenie sesji
      const session = await createGameSession(testSessionId, hostUid);
      expect(session.sessionId).toBe(testSessionId);
      expect(session.status).toBe('LOBBY');
      expect(session.hostUid).toBe(hostUid);
      expect(session.currentTurn).toBe(1);
      expect(session.currentPhase).toBe(1);
      expect(session.players).toEqual({});
      expect(Object.keys(session.marketState).length).toBe(6);

      // Pobranie z bazy
      const fetched = await getGameSession(testSessionId);
      expect(fetched).not.toBeNull();
      expect(fetched?.hostUid).toBe(hostUid);
    });

    it('powinien zapisać gracza i jego statek startowy w sesji gry', async () => {
      const { createGameSession, getGameSession, saveGameSession, createInitialPlayer } = firestoreModule;
      const testSessionId = `game_test_${Math.random().toString(36).substr(2, 9)}`;
      const hostUid = 'host_abc';
      const playerUid = 'player_xyz';

      // 1. Stworzenie gry
      const session = await createGameSession(testSessionId, hostUid);

      // 2. Stworzenie postaci gracza
      const player = createInitialPlayer(playerUid, 'Commander Riker');
      expect(player.characterName).toBe('Commander Riker');
      expect(player.gotowka).toBe(300);
      expect(player.reputacja).toBe(20);
      expect(player.statki.length).toBe(1);
      expect(player.statki[0].typKadluba).toBe('Klarnet');

      // 3. Dodanie do gry i zapis
      session.players[playerUid] = player;
      await saveGameSession(session);

      // 4. Pobranie gry i weryfikacja
      const fetched = await getGameSession(testSessionId);
      expect(fetched).not.toBeNull();
      
      const fetchedPlayer = fetched?.players[playerUid];
      expect(fetchedPlayer).toBeDefined();
      expect(fetchedPlayer?.characterName).toBe('Commander Riker');
      expect(fetchedPlayer?.gotowka).toBe(300);
      expect(fetchedPlayer?.statki[0].nazwa).toBe('Sokół 1');
      expect(fetchedPlayer?.statki[0].moduly).toContain('Bezpieczny skok');
    });
  });
});
