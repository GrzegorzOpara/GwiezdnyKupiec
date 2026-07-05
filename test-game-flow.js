const { io } = require('socket.io-client');

const HOST_URL = 'http://localhost:3000';
const TEST_SESSION_ID = 'test-game-flow-' + Date.now();

const player1 = io(HOST_URL, { auth: { token: 'test-token-player1' } });
const player2 = io(HOST_URL, { auth: { token: 'test-token-player2' } });

let playersJoined = 0;

async function runTest() {
  console.log('--- TESTOWANIE PRZEPŁYWU GRY (TIMER & OFERTY) ---');

  // Połączenie graczy
  player1.on('welcome', () => console.log('Player 1 connected'));
  player2.on('welcome', () => console.log('Player 2 connected'));

  // Player 1 zakłada grę
  setTimeout(() => {
    player1.emit('lobby:create', { sessionId: TEST_SESSION_ID, characterName: 'Hans Solo' });
  }, 500);

  player1.on('lobby:joined', () => {
    console.log('Player 1 dołączył do nowej gry');
    // Gdy Player 1 stworzy grę, Player 2 dołącza
    player2.emit('lobby:join', { sessionId: TEST_SESSION_ID, characterName: 'Chewbacca' });
  });

  player2.on('lobby:joined', () => {
    console.log('Player 2 dołączył do gry. Startujemy!');
    player1.emit('lobby:start', { sessionId: TEST_SESSION_ID });
  });

  player1.on('game:started', () => {
    console.log('Gra rozpoczęta (Status ACTIVE)! Host startuje odliczanie fazy LICYTACJI (5 sekund)...');
    player1.emit('game:startPhase', { sessionId: TEST_SESSION_ID, durationSeconds: 5 });
  });

  player1.on('game:phaseStarted', (data) => {
    console.log(`Faza ${data.phase} wystartowała! Koniec o:`, new Date(data.phaseEndTimeMs).toLocaleTimeString());
    
    // Obaj gracze wysyłają ukryte oferty (symulujemy, że P2 jest spóźniony)
    player1.emit('game:submitOrder', {
      sessionId: TEST_SESSION_ID,
      intent: {
        initiativeBidHT: 20, // P1 wydaje 20 HT na inicjatywę
        offers: [
          { commodity: 'izotopy', type: 'BUY', price: 10, amount: 2, systemId: 'mu_herculis' }
        ]
      }
    });

    setTimeout(() => {
      console.log('Player 2 wysyła ofertę tuż przed czasem...');
      player2.emit('game:submitOrder', {
        sessionId: TEST_SESSION_ID,
        intent: {
          initiativeBidHT: 50, // P2 wydaje 50 HT
          offers: [
            { commodity: 'izotopy', type: 'BUY', price: 10, amount: 4, systemId: 'mu_herculis' }
          ]
        }
      });
    }, 3000);
  });

  // Reagowanie na koniec fazy i rozliczenie
  player1.on('game:phaseResults', (data) => {
    console.log('\n--- ROZLICZENIE FAZY ---');
    const session = data.session;
    console.log(`Obecna faza to teraz: ${session.currentPhase}`);
    console.log('Inicjatywa rozstrzygnięta! Kolejność:', session.initiativeOrder);
    
    // Ponieważ to MVP, przechodzi od razu przez Inicjatywę i Transakcje. 
    // Faza powinna być z powrotem LICYTACJA (1), a tura 2.
    console.log(`Tura: ${session.currentTurn}, Faza: ${session.currentPhase}`);
    
    const p1State = Object.values(session.players).find(p => p.uid === 'player1');
    const p2State = Object.values(session.players).find(p => p.uid === 'player2');
    
    console.log(`Stan Player1: ${p1State.gotowka} HT, Magazyn Izotopów MuHerculis: ${p1State.magazyny['mu_herculis']?.izotopy || 0}`);
    console.log(`Stan Player2: ${p2State.gotowka} HT, Magazyn Izotopów MuHerculis: ${p2State.magazyny['mu_herculis']?.izotopy || 0}`);
    
    console.log('\nTest Zakończony Sukcesem! Zamykanie połączeń...');
    player1.disconnect();
    player2.disconnect();
    process.exit(0);
  });
}

runTest();
