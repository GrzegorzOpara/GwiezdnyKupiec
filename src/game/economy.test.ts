import { describe, it, expect, beforeEach } from 'vitest';
import { calculateNewPPIndicator, resolveMarketFluctuation, executeTransaction, PP_CALCULATOR } from './economy';
import { MarketState, Player } from './game.types';

describe('Silnik ekonomiczny (economy.ts)', () => {
  
  describe('calculateNewPPIndicator', () => {
    it('oblicza nową pozycję dodając rzut do modyfikatora', () => {
      expect(calculateNewPPIndicator(-4, 10)).toBe(6);
    });

    it('nie przekracza górnego limitu +18', () => {
      expect(calculateNewPPIndicator(10, 12)).toBe(18);
    });

    it('nie przekracza dolnego limitu -18', () => {
      expect(calculateNewPPIndicator(-10, 2)).toBe(-8); // -10 + 2 = -8
      expect(calculateNewPPIndicator(-15, 2)).toBe(-13);
      // Rzut 2K to minimalnie 2, wiec jesli mamy modyfikator np -20 i rzut 2 to wyjdzie -18
      expect(calculateNewPPIndicator(-22, 2)).toBe(-18);
    });
  });

  describe('resolveMarketFluctuation', () => {
    let market: MarketState;

    beforeEach(() => {
      market = {
        systemId: 'TauCeti',
        prices: { izotopy: 10, polimery: 10, podzespoly: 10, zywnosc: 10 },
        ppIndicator: { izotopy: 0, polimery: 0, podzespoly: 0, zywnosc: 0 }
      };
    });

    it('zmienia cenę towaru na podstawie pozycji żetonu P/P', () => {
      market.ppIndicator.izotopy = -18; // z kalkulatora daje +7
      resolveMarketFluctuation(market, 'izotopy');
      expect(market.prices.izotopy).toBe(17);

      market.ppIndicator.polimery = 18; // z kalkulatora daje -6
      resolveMarketFluctuation(market, 'polimery');
      expect(market.prices.polimery).toBe(4);
    });

    it('nie pozwala by cena przekroczyła 20', () => {
      market.prices.izotopy = 18;
      market.ppIndicator.izotopy = -18; // daje +7, czyli 18 + 7 = 25
      resolveMarketFluctuation(market, 'izotopy');
      expect(market.prices.izotopy).toBe(20);
    });

    it('nie pozwala by cena spadła poniżej 1', () => {
      market.prices.izotopy = 3;
      market.ppIndicator.izotopy = 18; // daje -6, czyli 3 - 6 = -3
      resolveMarketFluctuation(market, 'izotopy');
      expect(market.prices.izotopy).toBe(1);
    });
  });

  describe('executeTransaction', () => {
    let player: Player;
    let market: MarketState;

    beforeEach(() => {
      player = {
        uid: 'player1',
        characterName: 'Testowy',
        gotowka: 300,
        reputacja: 20,
        powiazania: { polityczne: 0, gospodarcze: 0, kryminalne: 0 },
        statki: [],
        magazyny: {},
        fabryki: {}
      };

      market = {
        systemId: 'TauCeti',
        prices: { izotopy: 10, polimery: 10, podzespoly: 10, zywnosc: 10 },
        ppIndicator: { izotopy: 0, polimery: 0, podzespoly: 0, zywnosc: 0 }
      };
    });

    it('pozwala kupić towar, aktualizuje portfel, magazyn i wskaźnik P/P', () => {
      executeTransaction(player, market, 'izotopy', 5, 10, true);
      
      expect(player.gotowka).toBe(250); // 300 - (5 * 10)
      expect(player.magazyny['TauCeti'].izotopy).toBe(5);
      expect(market.ppIndicator.izotopy).toBe(-5); // Żeton przesuwa się o 5 w lewo (-)
    });

    it('rzuca błąd przy kupnie, jeśli gracz ma za mało gotówki', () => {
      expect(() => {
        executeTransaction(player, market, 'izotopy', 40, 10, true); // 400 HT, gracz ma 300
      }).toThrow(/Niewystarczająca ilość gotówki/);
      
      // Sprawdzenie, czy stan nie uległ zmianie (atomic)
      expect(player.gotowka).toBe(300);
      expect(market.ppIndicator.izotopy).toBe(0);
    });

    it('pozwala sprzedać towar, aktualizuje portfel, magazyn i wskaźnik P/P', () => {
      // Inicjacja magazynu gracza
      player.magazyny['TauCeti'] = { izotopy: 10, polimery: 0, podzespoly: 0, zywnosc: 0 };
      
      executeTransaction(player, market, 'izotopy', 3, 10, false);
      
      expect(player.gotowka).toBe(330); // 300 + (3 * 10)
      expect(player.magazyny['TauCeti'].izotopy).toBe(7); // 10 - 3
      expect(market.ppIndicator.izotopy).toBe(3); // Żeton przesuwa się o 3 w prawo (+)
    });

    it('rzuca błąd przy sprzedaży, jeśli gracz nie ma towaru', () => {
      expect(() => {
        executeTransaction(player, market, 'izotopy', 1, 10, false);
      }).toThrow(/Niewystarczająca ilość towaru w magazynie/);
    });

    it('ogranicza przesunięcie żetonu P/P do limitu -18 / +18', () => {
      player.gotowka = 1000;
      executeTransaction(player, market, 'izotopy', 25, 10, true); // kupuje 25, żeton na -25 -> -18
      expect(market.ppIndicator.izotopy).toBe(-18);

      player.magazyny['TauCeti'] = { izotopy: 50, polimery: 0, podzespoly: 0, zywnosc: 0 };
      executeTransaction(player, market, 'izotopy', 20, 10, false); // sprzedaje 20, żeton na +2 -> z -18 + 20 to daje 2
      expect(market.ppIndicator.izotopy).toBe(2);
      
      executeTransaction(player, market, 'izotopy', 20, 10, false); // sprzedaje 20, 2 + 20 = 22 -> 18
      expect(market.ppIndicator.izotopy).toBe(18);
    });
  });
});
