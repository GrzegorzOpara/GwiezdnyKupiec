import { describe, it, expect } from 'vitest';
import { rollDice, rollMultipleDice, generateInitialConnections } from './utils';

describe('Funkcje pomocnicze gry (utils)', () => {
  describe('rollDice', () => {
    it('powinien zawsze zwracać liczbę całkowitą z przedziału 1 do 6', () => {
      for (let i = 0; i < 100; i++) {
        const val = rollDice();
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('rollMultipleDice', () => {
    it('powinien poprawnie sumować rzuty wieloma kośćmi', () => {
      const sum2K = rollMultipleDice(2);
      expect(sum2K).toBeGreaterThanOrEqual(2);
      expect(sum2K).toBeLessThanOrEqual(12);

      const sum3K = rollMultipleDice(3);
      expect(sum3K).toBeGreaterThanOrEqual(3);
      expect(sum3K).toBeLessThanOrEqual(18);
    });
  });

  describe('generateInitialConnections', () => {
    it('powinien poprawnie rozdzielić zadaną sumę punktów (forcedRoll)', () => {
      const connections = generateInitialConnections(10);
      
      expect(connections.polityczne).toBeLessThanOrEqual(10);
      expect(connections.gospodarcze).toBeLessThanOrEqual(10);
      expect(connections.kryminalne).toBeLessThanOrEqual(10);
      
      const totalPoints = connections.polityczne + connections.gospodarcze + connections.kryminalne;
      expect(totalPoints).toBe(10);
    });

    it('powinien poprawnie rozdzielić punkty przy losowym rzucie (bez forcedRoll)', () => {
      const connections = generateInitialConnections();
      
      expect(connections.polityczne).toBeLessThanOrEqual(10);
      expect(connections.gospodarcze).toBeLessThanOrEqual(10);
      expect(connections.kryminalne).toBeLessThanOrEqual(10);
      
      const totalPoints = connections.polityczne + connections.gospodarcze + connections.kryminalne;
      expect(totalPoints).toBeGreaterThanOrEqual(2);
      expect(totalPoints).toBeLessThanOrEqual(12);
    });

    it('żadna cecha nie powinna przekroczyć limitu 10, nawet przy dużej liczbie punktów', () => {
      // Dla 35 punktów (teoretycznie więcej niż maksymalna suma 3 * 10 = 30)
      const connections = generateInitialConnections(35);
      
      expect(connections.polityczne).toBeLessThanOrEqual(10);
      expect(connections.gospodarcze).toBeLessThanOrEqual(10);
      expect(connections.kryminalne).toBeLessThanOrEqual(10);
      
      // Powinno rozdzielić do maksa, czyli 10 + 10 + 10 = 30
      const totalPoints = connections.polityczne + connections.gospodarcze + connections.kryminalne;
      expect(totalPoints).toBe(30);
    });
  });
});
