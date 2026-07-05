import { Powiazania } from './game.types';

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollMultipleDice(count: number): number {
  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += rollDice();
  }
  return sum;
}

export function generateInitialConnections(forcedRoll?: number): Powiazania {
  // Jeśli forcedRoll jest podany, używamy go bezpośrednio (przydatne do testów)
  const total = forcedRoll !== undefined ? forcedRoll : rollMultipleDice(2);
  
  let p = 0, g = 0, k = 0;
  for (let i = 0; i < total; i++) {
    const available: ('p' | 'g' | 'k')[] = [];
    if (p < 10) available.push('p');
    if (g < 10) available.push('g');
    if (k < 10) available.push('k');
    
    if (available.length === 0) break; // wszystkie cechy osiągnęły limit 10
    
    const choice = available[Math.floor(Math.random() * available.length)];
    if (choice === 'p') p++;
    else if (choice === 'g') g++;
    else k++;
  }
  return { polityczne: p, gospodarcze: g, kryminalne: k };
}
