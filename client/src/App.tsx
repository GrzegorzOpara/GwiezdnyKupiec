import React from 'react';
import { SocketProvider, useGameSocket } from './context/SocketContext';
import { LoginView } from './views/LoginView';
import { LobbyView } from './views/LobbyView';
import { GameView } from './views/GameView';
import './App.css';

const GameOrchestrator: React.FC = () => {
  const { userToken, gameState } = useGameSocket();

  if (!userToken) {
    return <LoginView />;
  }

  if (!gameState) {
    return <LobbyView />;
  }

  return <GameView />;
};

function App() {
  return (
    <SocketProvider>
      <div className="app-container">
        {/* Efekt skanowania linii terminala */}
        <div className="scanlines"></div>
        
        {/* Dynamiczne widoki */}
        <GameOrchestrator />
      </div>
    </SocketProvider>
  );
}

export default App;
