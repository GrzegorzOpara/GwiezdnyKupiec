import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameSession, GamePhase } from './game.types';
import {
  resolveLicytacjaPhase,
  resolveInicjatywaPhase,
  resolveTransakcjePhase,
  progressToNextPhase,
  resumeFromCombatPhase
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
          dlugBankowy: 0,
          statki: [], magazyny: {}, fabryki: {}
        },
        'playerB': {
          uid: 'playerB', characterName: 'B', gotowka: 50, reputacja: 20,
          powiazania: { polityczne: 0, gospodarcze: 0, kryminalne: 0 },
          dlugBankowy: 0,
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
        'playerA': { 
          initiativeBidHT: 20, offers: [], shipMoves: [], shipPurchases: [], 
          factoryPurchases: [], loanRequests: 0, loanRepayments: 0, loadPassengers: [], isSubmitted: true 
        },
        'playerB': { 
          initiativeBidHT: 60, offers: [], shipMoves: [], shipPurchases: [], 
          factoryPurchases: [], loanRequests: 0, loanRepayments: 0, loadPassengers: [], isSubmitted: true 
        },
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
      session.turnIntents['playerA'] = { 
        initiativeBidHT: 0, isSubmitted: true, shipMoves: [], shipPurchases: [], factoryPurchases: [], loanRequests: 0, loanRepayments: 0, loadPassengers: [], offers: [
        { playerId: 'playerA', systemId: 'TauCeti', commodity: 'izotopy', type: 'BUY', limitPrice: 10, amount: 5 }
      ]};
      session.turnIntents['playerB'] = { 
        initiativeBidHT: 0, isSubmitted: true, shipMoves: [], shipPurchases: [], factoryPurchases: [], loanRequests: 0, loanRepayments: 0, loadPassengers: [], offers: [
        { playerId: 'playerB', systemId: 'TauCeti', commodity: 'izotopy', type: 'BUY', limitPrice: 10, amount: 3 }
      ]};
    });

    it('wykonuje transakcje zgodnie z kolejnością inicjatywy i zdejmuje P/P', () => {
      resolveTransakcjePhase(session);
      
      // playerA kupił 5 sztuk (10 HT) -> 50 HT
      expect(session.players['playerA'].gotowka).toBe(50); // 100 - 50
      expect(session.players['playerA'].magazyny['TauCeti'].izotopy).toBe(5);
      
      // playerB próbował kupić 3 sztuki z limitem 10 HT, ale rynek skoczył na 11 HT!
      // Jego transakcja zostaje odrzucona.
      expect(session.players['playerB'].gotowka).toBe(50); // Miał 50, nie wydał
      const magazyn = session.players['playerB'].magazyny['TauCeti'];
      expect(magazyn ? magazyn.izotopy : 0).toBe(0);
      
      // Żeton P/P po zakupie 5 sztuk przesuwa się na -5
      expect(session.marketState['TauCeti'].ppIndicator.izotopy).toBe(-5);
    });

    it('fluktuuje ceny rynkowe po transakcjach na podstawie końcowego P/P', () => {
      resolveTransakcjePhase(session);
      
      // P/P jest na -5. Według PP_CALCULATOR, -5 daje modyfikator +1
      // Cena początkowa to 10. Więc nowa cena powinna wynosić 11.
      expect(session.marketState['TauCeti'].prices.izotopy).toBe(11);
    });

    it('pozostawia bufor intencji (turnIntents) aż do fazy Kontroli', () => {
      resolveTransakcjePhase(session);
      expect(Object.keys(session.turnIntents).length).toBe(2);
    });
  });

  describe('progressToNextPhase', () => {
    it('przechodzi płynnie przez pełne 8 faz tury', () => {
      // 1 -> 2
      progressToNextPhase(session);
      expect(session.currentPhase).toBe(GamePhase.INICJATYWA);
      
      // 2 -> 3
      progressToNextPhase(session);
      expect(session.currentPhase).toBe(GamePhase.WIADOMOSCI);
      
      // 3 -> 4
      progressToNextPhase(session);
      expect(session.currentPhase).toBe(GamePhase.HIPERSKOKI);
      
      // Dodajemy statek do ruchu dla playerA w fazie 4
      session.players['playerA'].statki.push({
        id: 'ship_1', nazwa: 'A', typKadluba: 'Klarnet', moduly: ['Bezpieczny skok'], klasaZalogi: 'C',
        ladunek: { izotopy: 0, polimery: 0, podzespoly: 0, zywnosc: 0 },
        pasazerowie: [], lokacja: { systemId: 'OldSystem', obszar: 'PORT' }, uszkodzenia: []
      });
      session.turnIntents['playerA'].shipMoves = [{ shipId: 'ship_1', targetSystemId: 'NewSystem' }];
      
      // 4 -> Próba wejścia w 5
      progressToNextPhase(session);
      // Jeśli pirat wylosowany (15% szans), to session.status = 'COMBAT_PAUSE'
      if (session.status === 'COMBAT_PAUSE') {
        expect(session.currentPhase).toBe(GamePhase.HIPERSKOKI); // utknęliśmy
        // Gracz podejmuje decyzję, wznowienie:
        resumeFromCombatPhase(session);
        expect(session.status).toBe('ACTIVE');
        expect(session.currentPhase).toBe(GamePhase.TRANSAKCJE); // przeskoczyliśmy
      } else {
        expect(session.currentPhase).toBe(GamePhase.TRANSAKCJE);
      }

      // Statek przeniósł się w przestrzeń z celem NewSystem
      expect(session.players['playerA'].statki[0].lokacja.systemId).toBe('NewSystem');
      expect(session.players['playerA'].statki[0].lokacja.obszar).toBe('PRZESTRZEN');
      expect(session.players['playerA'].gotowka).toBe(60);

      // 5 -> 6
      progressToNextPhase(session);
      expect(session.currentPhase).toBe(GamePhase.OKAZJE);

      // 6 -> 7
      progressToNextPhase(session);
      expect(session.currentPhase).toBe(GamePhase.INWESTYCJE);
      
      // 7 -> 8
      // Podatek za 1 statek = 10 HT. PlayerA ma 60 HT -> 50 HT.
      progressToNextPhase(session);
      expect(session.currentPhase).toBe(GamePhase.KONTROLA);
      expect(session.players['playerA'].gotowka).toBe(50);
      expect(Object.keys(session.turnIntents).length).toBe(2); // Jeszcze nie wyczyszczone przed wykonaniem 8

      // 8 -> 1 (Nowa tura)
      progressToNextPhase(session);
      expect(session.currentPhase).toBe(GamePhase.LICYTACJA);
      expect(session.currentTurn).toBe(2);
      expect(Object.keys(session.turnIntents).length).toBe(0); // Czyszczenie po Kontroli
    });
  });
});
