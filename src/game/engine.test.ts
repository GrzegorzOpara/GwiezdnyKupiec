import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameSession, GamePhase } from './game.types';
import {
  resolveLicytacjaPhase,
  resolveInicjatywaPhase,
  resolveTransakcjePhase,
  progressToNextPhase
} from './engine';

describe('Silnik Gry (Maszyna Stanów) - engine.ts', () => {
  let session: GameSession;

  beforeEach(() => {
    session = {
      sessionId: 'testSession',
      status: 'ACTIVE',
      hostUid: 'host1',
      currentTurn: 1,
      currentPhase: GamePhase.LICYTACJA,
      createdAt: 'timestamp',
      initiativeOrder: [],
      players: {
        'playerA': {
          uid: 'playerA', characterName: 'A', gotowka: 100, reputacja: 20,
          powiazania: { polityczne: 0, gospodarcze: 0, kryminalne: 0 },
          statki: [], magazyny: {}, fabryki: {}
        },
        'playerB': {
          uid: 'playerB', characterName: 'B', gotowka: 50, reputacja: 20,
          powiazania: { polityczne: 0, gospodarcze: 0, kryminalne: 0 },
          statki: [], magazyny: {}, fabryki: {}
        }
      },
      marketState: {
        'TauCeti': {
          systemId: 'TauCeti',
          prices: { izotopy: 10, polimery: 10, podzespoly: 10, zywnosc: 10 },
          ppIndicator: { izotopy: 0, polimery: 0, podzespoly: 0, zywnosc: 0 }
        }
      },
      turnIntents: {
        'playerA': { initiativeBidHT: 20, offers: [], isSubmitted: true },
        'playerB': { initiativeBidHT: 60, offers: [], isSubmitted: true }, // chce wydać 60, a ma 50
      }
    };
  });

  describe('resolveLicytacjaPhase', () => {
    it('pobiera gotówkę graczy za licytację Inicjatywy', () => {
      resolveLicytacjaPhase(session);
      expect(session.players['playerA'].gotowka).toBe(80); // 100 - 20
    });

    it('zeruje gotówkę, jeśli gracz deklaruje więcej niż ma', () => {
      resolveLicytacjaPhase(session);
      expect(session.players['playerB'].gotowka).toBe(0); // miał 50, zadeklarował 60
      expect(session.turnIntents['playerB'].initiativeBidHT).toBe(50); // zaktualizowany bid
    });
  });

  describe('resolveInicjatywaPhase', () => {
    it('ustala kolejność graczy na podstawie licytacji i rzutów kostką', () => {
      // Przygotowujemy stan po odjęciu gotówki (chociaż nie jest to wymagane do Inicjatywy, ale dla zgodności)
      resolveLicytacjaPhase(session); 
      // playerA bid = 20
      // playerB bid = 50
      
      // Wstrzykujemy symulowane rzuty kostką:
      // PlayerA wyrzuci 12, suma = 32
      // PlayerB wyrzuci 2, suma = 52
      resolveInicjatywaPhase(session, { 'playerA': 12, 'playerB': 2 });
      
      expect(session.initiativeOrder).toEqual(['playerB', 'playerA']); // B ma wyższy wynik
    });
  });

  describe('resolveTransakcjePhase', () => {
    beforeEach(() => {
      // Inicjujemy inicjatywę
      session.initiativeOrder = ['playerA', 'playerB'];
      
      // Ustawiamy oferty
      session.turnIntents['playerA'].offers = [
        { playerId: 'playerA', systemId: 'TauCeti', commodity: 'izotopy', type: 'BUY', price: 10, amount: 5 }
      ];
      session.turnIntents['playerB'].offers = [
        { playerId: 'playerB', systemId: 'TauCeti', commodity: 'izotopy', type: 'BUY', price: 10, amount: 3 }
      ];
    });

    it('wykonuje transakcje zgodnie z kolejnością inicjatywy i zdejmuje P/P', () => {
      resolveTransakcjePhase(session);
      
      // playerA kupił 5
      expect(session.players['playerA'].gotowka).toBe(50); // 100 - 50
      expect(session.players['playerA'].magazyny['TauCeti'].izotopy).toBe(5);
      
      // playerB kupił 3
      expect(session.players['playerB'].gotowka).toBe(20); // 50 - 30
      expect(session.players['playerB'].magazyny['TauCeti'].izotopy).toBe(3);
      
      // Żeton P/P po zakupie 8 sztuk przesuwa się na -8
      expect(session.marketState['TauCeti'].ppIndicator.izotopy).toBe(-8);
    });

    it('fluktuuje ceny rynkowe po transakcjach na podstawie końcowego P/P', () => {
      resolveTransakcjePhase(session);
      
      // P/P jest na -8. Według PP_CALCULATOR, -8 daje modyfikator +2
      // Cena początkowa to 10. Więc nowa cena powinna wynosić 12.
      expect(session.marketState['TauCeti'].prices.izotopy).toBe(12);
    });

    it('czyści bufor intencji (turnIntents) na koniec fazy transakcji', () => {
      resolveTransakcjePhase(session);
      expect(Object.keys(session.turnIntents).length).toBe(0);
    });
  });

  describe('progressToNextPhase', () => {
    it('przechodzi płynnie przez cały MVP flow (Licytacja -> Inicjatywa -> Transakcje -> Koniec tury)', () => {
      // Faza 1: Licytacja
      progressToNextPhase(session);
      expect(session.currentPhase).toBe(GamePhase.INICJATYWA);
      expect(session.players['playerA'].gotowka).toBe(80);
      
      // Faza 2: Inicjatywa
      progressToNextPhase(session);
      expect(session.currentPhase).toBe(GamePhase.TRANSAKCJE);
      expect(session.initiativeOrder.length).toBe(2);
      
      // Dodajmy ofertę testową w transakcjach
      session.turnIntents['playerA'] = { initiativeBidHT: 0, isSubmitted: true, offers: [
        { playerId: 'playerA', systemId: 'TauCeti', commodity: 'izotopy', type: 'BUY', price: 10, amount: 2 }
      ]};

      // Faza 5 (MVP): Transakcje
      progressToNextPhase(session);
      expect(session.currentPhase).toBe(GamePhase.LICYTACJA); // Koniec MVP tury -> Faza 1
      expect(session.currentTurn).toBe(2); // Kolejna tura
      
      expect(session.players['playerA'].gotowka).toBe(60); // 80 - 20 (kupno)
    });
  });
});
