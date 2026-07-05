import React, { useState, useEffect } from 'react';
import { useGameSocket } from '../context/SocketContext';
import { GamePhase } from '../types/game.types';
import type { TowarId } from '../types/game.types';
import { Shield, Coins, AlertOctagon, TrendingUp, Compass, Factory, Users } from 'lucide-react';

export const GameView: React.FC = () => {
  const { gameState, characterName, submitTurnIntent, submitCombatDecision, startGame, transferCargo } = useGameSocket();
  const [activeTransferShipId, setActiveTransferShipId] = useState<string | null>(null);

  const [bid, setBid] = useState(0);
  
  // Transakcje
  const [commodity, setCommodity] = useState<TowarId>('izotopy');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [limitPrice, setLimitPrice] = useState(10);
  const [amount, setAmount] = useState(1);
  const [systemId, setSystemId] = useState('mu_herculis');
  const [offersList, setOffersList] = useState<any[]>([]);

  // Ruchy statków
  const [selectedShipId, setSelectedShipId] = useState('');
  const [targetSystem, setTargetSystem] = useState('tau_ceti');
  const [shipMoves, setShipMoves] = useState<any[]>([]);

  // Pasażerowie
  const [loadPassengerShipId, setLoadPassengerShipId] = useState('');
  const [passengerAmount, setPassengerAmount] = useState(1);
  const [loadPassengers, setLoadPassengers] = useState<any[]>([]);

  // Kredyty i Inwestycje
  const [loanRequest, setLoanRequest] = useState(0);
  const [loanRepayment, setLoanRepayment] = useState(0);
  
  // Zakup Statków
  const [hullType, setHullType] = useState('Klarnet');
  const [modules, setModules] = useState<string[]>([]);
  const [shipPurchases, setShipPurchases] = useState<any[]>([]);

  // Zakup Fabryk
  const [factorySystem, setFactorySystem] = useState('mu_herculis');
  const [factoryCommodity, setFactoryCommodity] = useState<TowarId>('izotopy');
  const [factorySize, setFactorySize] = useState(1);
  const [factoryPurchases, setFactoryPurchases] = useState<any[]>([]);

  const [isReady, setIsReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!gameState || !gameState.phaseEndTimeMs) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const diff = gameState.phaseEndTimeMs! - Date.now();
      if (diff <= 0) {
        setTimeLeft(0);
      } else {
        setTimeLeft(Math.ceil(diff / 1000));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [gameState?.phaseEndTimeMs, gameState?.currentPhase]);

  if (!gameState) return null;

  const currentUserId = Object.keys(gameState.players).find(
    uid => gameState.players[uid].characterName === characterName
  ) || '';
  
  const currentPlayer = gameState.players[currentUserId];
  const isHost = gameState.hostUid === currentUserId;

  const getPhaseName = (phase: GamePhase) => {
    switch (phase) {
      case GamePhase.LICYTACJA: return 'Faza 1: Licytacja Inicjatywy';
      case GamePhase.INICJATYWA: return 'Faza 2: Rezultat Inicjatywy';
      case GamePhase.WIADOMOSCI: return 'Faza 3: Biuletyn Informacyjny';
      case GamePhase.HIPERSKOKI: return 'Faza 4: Hiperskoki i Podróż';
      case GamePhase.TRANSAKCJE: return 'Faza 5: Transakcje Giełdowe';
      case GamePhase.OKAZJE: return 'Faza 6: Okazje i Wydarzenia';
      case GamePhase.INWESTYCJE: return 'Faza 7: Inwestycje i Stocznia';
      case GamePhase.KONTROLA: return 'Faza 8: Kontrola i Raporty';
      default: return 'Nieznana Faza';
    }
  };

  // Obsługa wysyłania formularzy
  const handleAddOffer = () => {
    setOffersList([...offersList, { commodity, type: tradeType, limitPrice, amount, systemId }]);
  };

  const handleAddMove = () => {
    if (!selectedShipId) return;
    if (shipMoves.some(m => m.shipId === selectedShipId)) {
      alert("Ten statek ma już zaplanowany skok w tej turze!");
      return;
    }
    setShipMoves([...shipMoves, { shipId: selectedShipId, targetSystemId: targetSystem }]);
  };

  const handleAddLoadPassenger = () => {
    if (!loadPassengerShipId) return;
    setLoadPassengers([...loadPassengers, { shipId: loadPassengerShipId, amount: passengerAmount }]);
  };

  const handleAddShipPurchase = () => {
    setShipPurchases([...shipPurchases, { hullType, modules, systemId: 'mu_herculis' }]);
  };

  const handleAddFactoryPurchase = () => {
    setFactoryPurchases([...factoryPurchases, { systemId: factorySystem, commodity: factoryCommodity, size: factorySize }]);
  };

  const handleToggleModule = (modName: string) => {
    if (modules.includes(modName)) {
      setModules(modules.filter(m => m !== modName));
    } else {
      setModules([...modules, modName]);
    }
  };

  const handleConfirmIntent = () => {
    const intent = {
      initiativeBidHT: bid,
      offers: offersList,
      shipMoves,
      shipPurchases,
      factoryPurchases,
      loanRequests: loanRequest,
      loanRepayments: loanRepayment,
      loadPassengers,
      isSubmitted: true
    };
    submitTurnIntent(gameState.sessionId, intent);
    setIsReady(true);
  };

  // Reset stanów lokalnych przy zmianie fazy
  useEffect(() => {
    setIsReady(false);
    setOffersList([]);
    setShipMoves([]);
    setShipPurchases([]);
    setFactoryPurchases([]);
    setLoadPassengers([]);
    setLoanRequest(0);
    setLoanRepayment(0);
    setBid(0);
  }, [gameState.currentPhase]);

  // --- LOBBY VIEW ---
  if (gameState.status === 'LOBBY') {
    return (
      <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="glass-panel" style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
          <h2 className="hud-title" style={{ marginBottom: '1.5rem' }}>Poczekalnia: <span className="hud-accent">{gameState.sessionId}</span></h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Oczekiwanie na graczy przed skokiem w nadprzestrzeń...</p>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '4px', textAlign: 'left', marginBottom: '2rem', border: '1px solid var(--border-cyan)' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--neon-cyan)', marginBottom: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Zarejestrowani Kapitanowie:</h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.values(gameState.players).map((p: any) => (
                <li key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <Shield size={14} className="hud-accent" /> {p.characterName} {p.uid === gameState.hostUid ? '(Gubernator)' : ''}
                </li>
              ))}
            </ul>
          </div>

          {isHost ? (
            <button onClick={() => startGame(gameState.sessionId)} className="btn-futuristic" style={{ width: '100%' }}>
              Uruchom Silniki (Start Gry)
            </button>
          ) : (
            <div style={{ color: 'var(--neon-amber)', fontSize: '0.9rem' }}>
              Oczekiwanie aż Gubernator rozpocznie grę...
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- COMBAT INTERRUPT SCREEN ---
  if (gameState.status === 'COMBAT_PAUSE') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,0,5,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel danger" style={{ maxWidth: '550px', width: '100%', textAlign: 'center', border: '2px solid var(--neon-magenta)', padding: '3rem 2rem' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(255,0,85,0.1)', borderRadius: '50%', marginBottom: '1.5rem' }}>
            <AlertOctagon size={48} style={{ color: 'var(--neon-magenta)' }} />
          </div>
          <h1 className="hud-title" style={{ fontSize: '2.2rem', color: 'var(--neon-magenta)', marginBottom: '0.5rem' }}>ALARM BOJOWY</h1>
          <p style={{ color: 'var(--text-primary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2rem' }}>
            Przechwycenie przez Piratów w przestrzeni kosmicznej!
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button onClick={() => submitCombatDecision(gameState.sessionId, 'WALKA')} className="btn-futuristic danger" style={{ fontSize: '1rem' }}>
              Walcz (Uruchom Tarcze i Działa)
            </button>
            <button onClick={() => submitCombatDecision(gameState.sessionId, 'UCIECZKA')} className="btn-futuristic warning" style={{ fontSize: '1rem' }}>
              Uciekaj (Skok w Ciemno)
            </button>
            <button onClick={() => submitCombatDecision(gameState.sessionId, 'PODDANIE')} className="btn-futuristic" style={{ fontSize: '1rem', borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}>
              Poddaj Ładunek (Unikaj zniszczenia)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getPriceExtremes = () => {
    const extremes: Record<string, { minPrice: number; maxPrice: number; minSystems: string[]; maxSystems: string[] }> = {
      izotopy: { minPrice: 99, maxPrice: 0, minSystems: [], maxSystems: [] },
      polimery: { minPrice: 99, maxPrice: 0, minSystems: [], maxSystems: [] },
      podzespoly: { minPrice: 99, maxPrice: 0, minSystems: [], maxSystems: [] },
      zywnosc: { minPrice: 99, maxPrice: 0, minSystems: [], maxSystems: [] }
    };

    if (!gameState?.marketState) return extremes;

    const commodities: TowarId[] = ['izotopy', 'polimery', 'podzespoly', 'zywnosc'];
    const systems = Object.keys(gameState.marketState);

    for (const comm of commodities) {
      let min = 99;
      let max = 0;
      
      for (const sysId of systems) {
        const price = gameState.marketState[sysId].prices[comm];
        if (price < min) min = price;
        if (price > max) max = price;
      }
      extremes[comm].minPrice = min;
      extremes[comm].maxPrice = max;

      for (const sysId of systems) {
        const price = gameState.marketState[sysId].prices[comm];
        if (price === min) extremes[comm].minSystems.push(sysId);
        if (price === max) extremes[comm].maxSystems.push(sysId);
      }
    }
    return extremes;
  };

  // --- ACTIVE GAMEPLAY VIEW ---
  const extremes = getPriceExtremes();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 380px', minHeight: '100vh', gap: '1rem', padding: '1rem' }}>
      
      {/* PANEL BOCZNY (HUD GRACZA) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Podstawowe dane */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="hud-title" style={{ fontSize: '1.1rem' }}>Konsola <span className="hud-accent">Gracza</span></h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TURA {gameState.currentTurn}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Kapitan:</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>{currentPlayer?.characterName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}><Coins size={14} /> Gotówka:</span>
              <span className="hud-accent" style={{ fontWeight: 'bold' }}>{currentPlayer?.gotowka} HT</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}><AlertOctagon size={14} style={{ color: 'var(--neon-amber)' }} /> Dług Bankowy:</span>
              <span style={{ color: 'var(--neon-amber)', fontWeight: 'bold' }}>{currentPlayer?.dlugBankowy} HT</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}><TrendingUp size={14} style={{ color: 'var(--neon-green)' }} /> Reputacja:</span>
              <span style={{ color: 'var(--neon-green)', fontWeight: 'bold' }}>{currentPlayer?.reputacja} / 40</span>
            </div>
          </div>
        </div>

        {/* Flota i ładunek */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 className="hud-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Compass size={16} /> Twoja Flota</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '350px' }}>
            {currentPlayer?.statki.map((ship: any) => {
              const maxCargo = ship.moduly.filter((m: string) => 
                m.toLowerCase().includes('towarowy') || 
                m.toLowerCase().includes('ładun') || 
                m.toLowerCase().includes('kontener')
              ).length;
              const currentCargo = Object.values(ship.ladunek).reduce((sum: number, v: any) => sum + v, 0) as number;

              return (
                <div key={ship.id} style={{ border: '1px solid var(--border-cyan)', padding: '0.75rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    <span>{ship.nazwa}</span>
                    <span className="hud-accent">[{ship.typKadluba}]</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    Pozycja: {ship.lokacja.systemId.toUpperCase()} ({ship.lokacja.obszar})
                  </div>
                  {ship.uszkodzenia.length > 0 && (
                    <div style={{ color: 'var(--neon-magenta)', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                      Uszkodzenia: {ship.uszkodzenia.join(', ')}
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
                    <strong>Ładunek:</strong> {Object.keys(ship.ladunek).map(c => ship.ladunek[c as TowarId] > 0 ? `${c}: ${ship.ladunek[c as TowarId]} ` : '').join('') || 'pusty'}
                  </div>
                  <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    <span>Pojemność ładowni:</span>
                    <span className="hud-accent" style={{ fontWeight: 'bold' }}>{currentCargo} / {maxCargo}</span>
                  </div>
                  {ship.pasazerowie.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--neon-green)', marginTop: '0.2rem' }}>
                      <strong>Pasażerowie:</strong> {ship.pasazerowie.map((p: any) => `Cel: ${p.celSystemId.toUpperCase()} `).join('')}
                    </div>
                  )}

                  {/* Panel Przeładunku Towarów */}
                  {(ship.lokacja.obszar === 'PORT' || ship.lokacja.obszar === 'PLANETA') && (
                    <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
                      <button 
                        type="button"
                        onClick={() => setActiveTransferShipId(activeTransferShipId === ship.id ? null : ship.id)}
                        className="btn-futuristic"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', width: '100%', borderColor: 'var(--border-cyan)', height: 'auto' }}
                      >
                        {activeTransferShipId === ship.id ? 'Zamknij Przeładunek' : 'Przeładuj Towary'}
                      </button>
                      
                      {activeTransferShipId === ship.id && (
                        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '4px' }}>
                          {['izotopy', 'polimery', 'podzespoly', 'zywnosc'].map((comm) => {
                            const warehouseQty = currentPlayer.magazyny[ship.lokacja.systemId]?.[comm as TowarId] || 0;
                            const shipQty = ship.ladunek[comm as TowarId] || 0;
                            return (
                              <div key={comm} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                                <span style={{ textTransform: 'capitalize', width: '70px', textOverflow: 'ellipsis', overflow: 'hidden' }}>{comm}:</span>
                                <span style={{ color: 'var(--text-muted)' }}>M:{warehouseQty} | S:{shipQty}</span>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <button 
                                    type="button"
                                    disabled={warehouseQty <= 0 || currentCargo >= maxCargo}
                                    onClick={() => transferCargo(gameState.sessionId, ship.id, comm, 1)}
                                    style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem', background: 'rgba(0,255,136,0.12)', border: '1px solid var(--neon-green)', color: 'var(--neon-green)', cursor: 'pointer', borderRadius: '2px' }}
                                  >
                                    Ładuj
                                  </button>
                                  <button 
                                    type="button"
                                    disabled={shipQty <= 0}
                                    onClick={() => transferCargo(gameState.sessionId, ship.id, comm, -1)}
                                    style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem', background: 'rgba(255,0,153,0.12)', border: '1px solid var(--neon-magenta)', color: 'var(--neon-magenta)', cursor: 'pointer', borderRadius: '2px' }}
                                  >
                                    Wyładuj
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {currentPlayer?.statki.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Brak statków we flocie.</span>}
          </div>

          <h3 className="hud-title" style={{ fontSize: '1rem', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Factory size={16} /> Fabryki i Magazyny</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
            {/* Magazyny */}
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '0.5px' }}>MAGAZYNY (TOWARY):</div>
              {currentPlayer && Object.keys(currentPlayer.magazyny || {}).some(sysId => Object.values(currentPlayer.magazyny[sysId]).some(v => v > 0)) ? (
                Object.keys(currentPlayer.magazyny).map((sysId) => {
                  const items = Object.keys(currentPlayer.magazyny[sysId])
                    .filter(c => currentPlayer.magazyny[sysId][c as TowarId] > 0)
                    .map(c => `${c}: ${currentPlayer.magazyny[sysId][c as TowarId]}`);
                  if (items.length === 0) return null;
                  return (
                    <div key={sysId} style={{ marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--neon-cyan)' }}>{sysId.replace('_', ' ').toUpperCase()}:</span> {items.join(', ')}
                    </div>
                  );
                })
              ) : (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Brak towarów.</span>
              )}
            </div>

            {/* Fabryki */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '0.5px' }}>FABRYKI (PRODUKCJA):</div>
              {currentPlayer && Object.keys(currentPlayer.fabryki || {}).some(sysId => Object.values(currentPlayer.fabryki[sysId]).some(v => v > 0)) ? (
                Object.keys(currentPlayer.fabryki).map((sysId) => {
                  const items = Object.keys(currentPlayer.fabryki[sysId])
                    .filter(c => currentPlayer.fabryki[sysId][c as TowarId] > 0)
                    .map(c => `${c} (Lvl ${currentPlayer.fabryki[sysId][c as TowarId]})`);
                  if (items.length === 0) return null;
                  return (
                    <div key={sysId} style={{ marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--neon-cyan)' }}>{sysId.replace('_', ' ').toUpperCase()}:</span> {items.join(', ')}
                    </div>
                  );
                })
              ) : (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Brak fabryk.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PANEL GŁÓWNY (KONSOLA CENTRALNA) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Górny HUD Fazy */}
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="hud-title" style={{ fontSize: '1.3rem' }}><span className="hud-accent">{getPhaseName(gameState.currentPhase)}</span></h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Zaplanuj swoje akcje handlowe, a następnie zatwierdź turę.</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {timeLeft !== null && (
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.1rem',
                color: timeLeft <= 5 ? 'var(--neon-magenta)' : 'var(--neon-amber)',
                border: `1px solid ${timeLeft <= 5 ? 'var(--border-magenta)' : 'var(--border-amber)'}`,
                padding: '0.4rem 0.8rem',
                borderRadius: '4px',
                boxShadow: timeLeft <= 5 ? 'var(--shadow-magenta)' : 'var(--shadow-amber)',
                background: 'rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>SEC:</span>
                <span style={{ fontWeight: 'bold' }}>{timeLeft}s</span>
              </div>
            )}

            <button 
              onClick={handleConfirmIntent} 
              disabled={isReady} 
              className="btn-futuristic" 
              style={{ borderColor: isReady ? 'var(--neon-green)' : 'var(--neon-cyan)', color: isReady ? 'var(--neon-green)' : 'var(--neon-cyan)' }}
            >
              {isReady ? 'Zatwierdzono' : 'Zatwierdź Turę'}
            </button>
          </div>
        </div>

        {/* Konsola Akcji Aktywnej Fazy */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Faza 1: Licytacja */}
          {gameState.currentPhase === GamePhase.LICYTACJA && (
            <div style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 className="hud-title" style={{ fontSize: '1.1rem' }}>Licytacja Inicjatywy</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Zadeklaruj ile Hektotransów (HT) jesteś w stanie zapłacić cesarstwu za pierwszeństwo ruchu w tej turze. Stawka jest bezzwrotna!
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="number" 
                  className="input-futuristic"
                  style={{ width: '120px' }} 
                  value={bid} 
                  onChange={(e) => setBid(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <span style={{ fontSize: '0.9rem' }}>HT</span>
              </div>
            </div>
          )}

          {/* Faza 2: Inicjatywa */}
          {gameState.currentPhase === GamePhase.INICJATYWA && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 className="hud-title" style={{ fontSize: '1.1rem' }}>Rezultat Inicjatywy</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Oto kolejność graczy w tej turze (licytacja + rzuty kośćmi):</p>
              
              <ol style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {gameState.initiativeOrder.map((uid, index) => (
                  <li key={uid} style={{ fontSize: '1rem', color: uid === currentUserId ? 'var(--neon-cyan)' : 'inherit' }}>
                    <strong>{index + 1}. {gameState.players[uid]?.characterName}</strong> {uid === currentUserId ? '(Ty)' : ''}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Faza 3: Wiadomości */}
          {gameState.currentPhase === GamePhase.WIADOMOSCI && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 className="hud-title" style={{ fontSize: '1.1rem' }}>Imperialny Biuletyn Informacyjny</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Zdarzenia rynkowe, kryzysy i fluktuacje surowców w tym układzie gwiezdnym:</p>
              
              <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderStyle: 'dashed' }}>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', listStyleType: 'square', paddingLeft: '1.25rem' }}>
                  <li>Zgłoszono ruchy piratów w pobliżu Alpha Centauri. Zalecane moduly bojowe.</li>
                  <li>Urodzaj żywności w sektorach Epsilon Eridani. Spodziewany spadek cen popytu.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Faza 4: Hiperskoki */}
          {gameState.currentPhase === GamePhase.HIPERSKOKI && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 className="hud-title" style={{ fontSize: '1.1rem' }}>Panel Nawigacyjny Lotów</h3>
              
              {/* Ruch statków */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Wybierz Statek:</label>
                  <select className="input-futuristic" value={selectedShipId} onChange={(e) => setSelectedShipId(e.target.value)}>
                    <option value="">-- wybierz statek --</option>
                    {currentPlayer?.statki.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.nazwa} (lokacja: {s.lokacja.systemId.toUpperCase()})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>System Docelowy:</label>
                  <select className="input-futuristic" value={targetSystem} onChange={(e) => setTargetSystem(e.target.value)}>
                    <option value="mu_herculis">Mu Herculis</option>
                    <option value="tau_ceti">Tau Ceti</option>
                    <option value="beta_hydri">Beta Hydri</option>
                    <option value="epsilon_eridani">Epsilon Eridani</option>
                    <option value="gamma_leporis">Gamma Leporis</option>
                    <option value="sigma_octantis">Sigma Octantis</option>
                  </select>
                </div>

                <button onClick={handleAddMove} className="btn-futuristic">Dodaj Skok</button>
              </div>

              {/* Zaplanowane ruchy */}
              {shipMoves.length > 0 && (
                <div style={{ border: '1px solid var(--border-cyan)', padding: '0.75rem', borderRadius: '4px' }}>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--neon-cyan)', marginBottom: '0.4rem' }}>Zaplanowane loty:</h4>
                  <ul style={{ fontSize: '0.85rem', listStyle: 'none', paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {shipMoves.map((m, i) => {
                      const ship = currentPlayer?.statki.find((s: any) => s.id === m.shipId);
                      return (
                        <li key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          🚀 <strong style={{ color: 'var(--neon-cyan)' }}>{ship ? ship.nazwa : 'Nieznany statek'}</strong> leci do <strong style={{ color: 'var(--neon-amber)' }}>{m.targetSystemId.replace('_', ' ').toUpperCase()}</strong>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Załadunek pasażerów */}
              <h3 className="hud-title" style={{ fontSize: '1.1rem', marginTop: '1rem' }}><Users size={16} /> Załadunek Pasażerów</h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <select className="input-futuristic" value={loadPassengerShipId} onChange={(e) => setLoadPassengerShipId(e.target.value)}>
                  <option value="">-- wybierz statek --</option>
                  {currentPlayer?.statki.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.nazwa} (kabiny: {s.moduly.filter((m: string) => m.toLowerCase().includes('pasażer') || m.toLowerCase().includes('kabina')).length})</option>
                  ))}
                </select>
                <input type="number" className="input-futuristic" style={{ width: '80px' }} value={passengerAmount} onChange={(e) => setPassengerAmount(Math.max(1, parseInt(e.target.value) || 1))} />
                <button onClick={handleAddLoadPassenger} className="btn-futuristic">Zabierz pasażera</button>
              </div>
            </div>
          )}

          {/* Faza 5: Transakcje */}
          {gameState.currentPhase === GamePhase.TRANSAKCJE && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 className="hud-title" style={{ fontSize: '1.1rem' }}>Giełda i Transakcje Limitowane</h3>
              
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Układ Gwiezdny:</label>
                  <select className="input-futuristic" value={systemId} onChange={(e) => setSystemId(e.target.value)}>
                    <option value="mu_herculis">Mu Herculis</option>
                    <option value="tau_ceti">Tau Ceti</option>
                    <option value="beta_hydri">Beta Hydri</option>
                    <option value="epsilon_eridani">Epsilon Eridani</option>
                    <option value="gamma_leporis">Gamma Leporis</option>
                    <option value="sigma_octantis">Sigma Octantis</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Akcja:</label>
                  <select className="input-futuristic" value={tradeType} onChange={(e) => setTradeType(e.target.value as 'BUY' | 'SELL')}>
                    <option value="BUY">KUPNO (Zlecenie BUY)</option>
                    <option value="SELL">SPRZEDAŻ (Zlecenie SELL)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Towar:</label>
                  <select className="input-futuristic" value={commodity} onChange={(e) => setCommodity(e.target.value as TowarId)}>
                    <option value="izotopy">Izotopy</option>
                    <option value="polimery">Polimery</option>
                    <option value="podzespoly">Podzespoły</option>
                    <option value="zywnosc">Żywność</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Limit Ceny (HT):</label>
                  <input type="number" className="input-futuristic" style={{ width: '80px' }} value={limitPrice} onChange={(e) => setLimitPrice(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ilość sztuk:</label>
                  <input type="number" className="input-futuristic" style={{ width: '80px' }} value={amount} onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>

                <button onClick={handleAddOffer} className="btn-futuristic">Dodaj Zlecenie</button>
              </div>

              {/* Lista aktualnie zaplanowanych transakcji gracza w tej turze */}
              {offersList.length > 0 && (
                <div style={{ border: '1px solid var(--border-cyan)', padding: '1rem', borderRadius: '4px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--neon-cyan)', marginBottom: '0.5rem' }}>Twoje arkusze zleceń w kolejce do rozliczenia:</h4>
                  <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                    {offersList.map((off, index) => (
                      <li key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.2rem' }}>
                        {off.type} {off.amount}x {off.commodity} w {off.systemId.toUpperCase()} po max/min cenie {off.limitPrice} HT
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Faza 6: Okazje */}
          {gameState.currentPhase === GamePhase.OKAZJE && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 className="hud-title" style={{ fontSize: '1.1rem' }}>Okazje Handlowe</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                W tej fazie gracze mogą wymieniać się informacjami prasowymi oraz kupować tajne zlecenia przemytnicze lub licencje rządowe.
              </p>
              <div className="glass-panel" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                System ofert okazyjnych dostępny jest w kolejnych aktualizacjach cesarstwa.
              </div>
            </div>
          )}

          {/* Faza 7: Inwestycje */}
          {gameState.currentPhase === GamePhase.INWESTYCJE && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 className="hud-title" style={{ fontSize: '1.1rem' }}>Stocznia, Kredyty i Fabryki</h3>
              
              {/* Sekcja Kredytów */}
              <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--neon-amber)' }}>Zaciągnij pożyczkę (HT):</label>
                  <input type="number" className="input-futuristic" style={{ width: '120px' }} value={loanRequest} onChange={(e) => setLoanRequest(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--neon-green)' }}>Spłata pożyczki (HT):</label>
                  <input type="number" className="input-futuristic" style={{ width: '120px' }} value={loanRepayment} onChange={(e) => setLoanRepayment(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>

              {/* Sekcja Stoczni */}
              <div>
                <h4 className="hud-title" style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Zakup Statków</h4>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kadłub:</label>
                    <select className="input-futuristic" value={hullType} onChange={(e) => setHullType(e.target.value)}>
                      <option value="Klarnet">Klarnet (Koszt: 200 HT)</option>
                      <option value="Pikulina">Pikulina (Koszt: 200 HT)</option>
                      <option value="Flet Sztylet">Flet Sztylet (Koszt: 200 HT)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Moduły (+50 HT/szt):</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        type="button" 
                        onClick={() => handleToggleModule('Towarowy')} 
                        className="btn-futuristic" 
                        style={{ 
                          padding: '0.4rem', 
                          fontSize: '0.7rem', 
                          borderColor: modules.includes('Towarowy') ? 'var(--neon-green)' : 'var(--text-muted)', 
                          color: modules.includes('Towarowy') ? 'var(--neon-green)' : 'var(--text-muted)' 
                        }}
                      >
                        Towarowy
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleToggleModule('Kabina pasażerska')} 
                        className="btn-futuristic" 
                        style={{ 
                          padding: '0.4rem', 
                          fontSize: '0.7rem', 
                          borderColor: modules.includes('Kabina pasażerska') ? 'var(--neon-green)' : 'var(--text-muted)', 
                          color: modules.includes('Kabina pasażerska') ? 'var(--neon-green)' : 'var(--text-muted)' 
                        }}
                      >
                        Pasażerski
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleToggleModule('Bezpieczny skok')} 
                        className="btn-futuristic" 
                        style={{ 
                          padding: '0.4rem', 
                          fontSize: '0.7rem', 
                          borderColor: modules.includes('Bezpieczny skok') ? 'var(--neon-green)' : 'var(--text-muted)', 
                          color: modules.includes('Bezpieczny skok') ? 'var(--neon-green)' : 'var(--text-muted)' 
                        }}
                      >
                        Bezpieczny Skok
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '100px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Koszt:</label>
                    <span style={{ fontSize: '0.9rem', fontFamily: 'var(--font-mono)', padding: '0.4rem 0', color: (200 + modules.length * 50) > currentPlayer.gotowka ? 'var(--neon-magenta)' : 'var(--neon-amber)', fontWeight: 'bold' }}>
                      {200 + modules.length * 50} HT
                    </span>
                  </div>

                  <button 
                    onClick={handleAddShipPurchase} 
                    disabled={(200 + modules.length * 50) > currentPlayer.gotowka} 
                    className="btn-futuristic"
                    style={{
                      borderColor: (200 + modules.length * 50) > currentPlayer.gotowka ? 'var(--text-muted)' : 'var(--neon-cyan)',
                      color: (200 + modules.length * 50) > currentPlayer.gotowka ? 'var(--text-muted)' : 'var(--neon-cyan)'
                    }}
                  >
                    {(200 + modules.length * 50) > currentPlayer.gotowka ? 'Brak środków' : 'Zamów Statek'}
                  </button>
                </div>
              </div>

              {/* Sekcja Fabryk */}
              <div>
                <h4 className="hud-title" style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Rozbudowa Fabryk (100 HT za poziom)</h4>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Układ:</label>
                    <select className="input-futuristic" value={factorySystem} onChange={(e) => setFactorySystem(e.target.value)}>
                      <option value="mu_herculis">Mu Herculis</option>
                      <option value="tau_ceti">Tau Ceti</option>
                      <option value="beta_hydri">Beta Hydri</option>
                      <option value="epsilon_eridani">Epsilon Eridani</option>
                      <option value="gamma_leporis">Gamma Leporis</option>
                      <option value="sigma_octantis">Sigma Octantis</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Towar:</label>
                    <select className="input-futuristic" value={factoryCommodity} onChange={(e) => setFactoryCommodity(e.target.value as TowarId)}>
                      <option value="izotopy">Izotopy</option>
                      <option value="polimery">Polimery</option>
                      <option value="podzespoly">Podzespoły</option>
                      <option value="zywnosc">Żywność</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rozmiar (+Lvl):</label>
                    <input type="number" className="input-futuristic" style={{ width: '80px' }} value={factorySize} onChange={(e) => setFactorySize(Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                  <button onClick={handleAddFactoryPurchase} className="btn-futuristic">Buduj Fabrykę</button>
                </div>
              </div>

              {/* Podsumowanie zakupów w tej turze */}
              {(shipPurchases.length > 0 || factoryPurchases.length > 0) && (
                <div style={{ border: '1px solid var(--border-cyan)', padding: '1rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--neon-cyan)', marginBottom: '0.5rem' }}>Zamówienia inwestycyjne w kolejce:</h4>
                  <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                    {shipPurchases.map((sp, idx) => (
                      <li key={`ship-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.2rem' }}>
                        🚢 Kupno statku <strong style={{ color: 'var(--neon-cyan)' }}>[{sp.hullType}]</strong> w stoczni MU HERCULIS z modułami: {sp.modules.join(', ') || 'brak'}
                      </li>
                    ))}
                    {factoryPurchases.map((fp, idx) => (
                      <li key={`factory-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.2rem' }}>
                        🏭 Rozbudowa fabryki <strong style={{ color: 'var(--neon-cyan)' }}>{fp.commodity}</strong> o +{fp.size} poziom(y) w {fp.systemId.replace('_', ' ').toUpperCase()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Faza 8: Kontrola */}
          {gameState.currentPhase === GamePhase.KONTROLA && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 className="hud-title" style={{ fontSize: '1.1rem' }}>Raport Kontroli Tury</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                To faza porządkowa. Silnik zakończył wszystkie transakcje i naliczył opłaty. Oczekiwanie na przejście do kolejnej tury.
              </p>
              <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem' }}>
                Status gotowości wszystkich kapitanów: oczekiwanie...
              </div>
            </div>
          )}

        </div>
      </div>

      {/* PANEL PRAWY - TABLICA CEN I REJESTR KAPITANÓW (PUBLICZNA PLANSZA) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '96vh', paddingRight: '0.25rem' }}>
        
        {/* Tablica Cen */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 className="hud-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <TrendingUp size={16} /> Tablica Cen Galaktycznych
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-cyan)', color: 'var(--text-muted)' }}>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.25rem' }}>Układ</th>
                <th style={{ padding: '0.4rem 0.25rem' }}>Izot</th>
                <th style={{ padding: '0.4rem 0.25rem' }}>Poli</th>
                <th style={{ padding: '0.4rem 0.25rem' }}>Podz</th>
                <th style={{ padding: '0.4rem 0.25rem' }}>Żywn</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(gameState.marketState).map(sysId => {
                const sysState = gameState.marketState[sysId];
                return (
                  <tr key={sysId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ textAlign: 'left', fontWeight: 'bold', padding: '0.4rem 0.25rem', color: 'var(--neon-cyan)' }}>
                      {sysId.replace('_', ' ').toUpperCase()}
                    </td>
                    {['izotopy', 'polimery', 'podzespoly', 'zywnosc'].map(comm => {
                      const price = sysState.prices[comm as TowarId];
                      const isMin = extremes[comm].minPrice === price;
                      const isMax = extremes[comm].maxPrice === price;
                      
                      let cellColor = 'var(--text-light)';
                      let cellBg = 'transparent';
                      if (isMin) {
                        cellColor = 'var(--neon-green)';
                        cellBg = 'rgba(0, 255, 136, 0.08)';
                      } else if (isMax) {
                        cellColor = 'var(--neon-magenta)';
                        cellBg = 'rgba(255, 0, 153, 0.08)';
                      }
                      
                      return (
                        <td key={comm} style={{ padding: '0.4rem 0.25rem', color: cellColor, backgroundColor: cellBg, fontFamily: 'var(--font-mono)' }}>
                          {price}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'rgba(0, 255, 136, 0.2)', border: '1px solid var(--neon-green)' }}></span> Kupno (najtaniej)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'rgba(255, 0, 153, 0.2)', border: '1px solid var(--neon-magenta)' }}></span> Sprzedaż (najdrożej)</span>
          </div>
        </div>

        {/* Rejestr kapitanów i flot */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 className="hud-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Users size={16} /> Rejestr Flot i Kapitanów
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
            {Object.keys(gameState.players).map(uid => {
              const player = gameState.players[uid];
              const isSelf = uid === currentUserId;
              return (
                <div key={uid} style={{ 
                  border: `1px solid ${isSelf ? 'var(--border-green)' : 'rgba(255,255,255,0.08)'}`, 
                  padding: '0.6rem', 
                  borderRadius: '4px',
                  background: isSelf ? 'rgba(0,255,136,0.02)' : 'rgba(0,0,0,0.15)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: isSelf ? 'var(--neon-green)' : 'var(--text-light)' }}>
                      {player.characterName} {isSelf && '(Ty)'}
                    </span>
                    <span style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem' }}>
                      Rep: {player.reputacja}/40
                    </span>
                  </div>
                  
                  {/* Flota gracza */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <strong>Flota:</strong>
                    {player.statki.length > 0 ? (
                      player.statki.map((s: any) => (
                        <div key={s.id} style={{ paddingLeft: '0.5rem', color: 'var(--text-light)' }}>
                          🚀 {s.nazwa} [{s.typKadluba}] → {s.lokacja.systemId.toUpperCase()} ({s.lokacja.obszar})
                        </div>
                      ))
                    ) : (
                      <div style={{ paddingLeft: '0.5rem', fontStyle: 'italic' }}>Brak statków</div>
                    )}
                  </div>

                  {/* Fabryki gracza */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    <strong>Fabryki:</strong>{' '}
                    {Object.keys(player.fabryki).some(sysId => Object.values(player.fabryki[sysId]).some(v => v > 0)) ? (
                      Object.keys(player.fabryki).map(sysId => {
                        const active = Object.keys(player.fabryki[sysId]).filter(c => player.fabryki[sysId][c as TowarId] > 0);
                        if (active.length === 0) return null;
                        return (
                          <span key={sysId} style={{ display: 'block', paddingLeft: '0.5rem', color: 'var(--text-light)' }}>
                            • {sysId.toUpperCase()}: {active.map(c => `${c} (Lvl ${player.fabryki[sysId][c as TowarId]})`).join(', ')}
                          </span>
                        );
                      })
                    ) : (
                      <span style={{ fontStyle: 'italic' }}>Brak fabryk</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
