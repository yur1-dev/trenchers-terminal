// ============================================================================
// components/WalletConnect.tsx
// ============================================================================

import React, { useState } from "react";

interface WalletConnectProps {
  onWalletConnect: (address: string) => boolean;
}

function isValidSolanaAddress(address: string): boolean {
  const trimmed = address.trim();
  if (!trimmed || trimmed.length < 32 || trimmed.length > 44) return false;
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(trimmed);
}

const WalletConnect: React.FC<WalletConnectProps> = ({ onWalletConnect }) => {
  const [walletInput, setWalletInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!walletInput.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    if (!isValidSolanaAddress(walletInput.trim())) {
      setError("Invalid Solana wallet address format");
      return;
    }

    const success = onWalletConnect(walletInput.trim());
    if (!success) {
      setError("Failed to connect wallet");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center space-y-8 max-w-2xl w-full">
        <div className="relative">
          <h1 className="text-4xl md:text-6xl font-black text-white font-mono mb-6 tracking-wider">
            TERMINAL_ARTILLERY.EXE
          </h1>
        </div>

        <p className="text-lg md:text-xl font-mono mb-8 tracking-wide text-gray-300">
          [AIM] [FIRE] [SURVIVE] TOURNAMENT_MODE
        </p>

        <div className="bg-black border border-gray-600 rounded p-6">
          <h3 className="text-xl md:text-2xl font-bold mb-6 text-white font-mono">
            CONNECT WALLET
          </h3>

          <div className="space-y-4">
            <input
              type="text"
              value={walletInput}
              onChange={(e) => {
                setWalletInput(e.target.value);
                if (error) setError("");
              }}
              onKeyPress={handleKeyPress}
              placeholder="Enter Solana wallet address..."
              className="w-full p-3 bg-black border border-gray-600 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
            />

            {error && (
              <p className="text-red-400 text-sm font-mono">ERROR: {error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!walletInput.trim()}
              className="w-full font-bold py-4 px-8 rounded transition-all font-mono bg-white text-black border border-gray-300 hover:bg-gray-200 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              CONNECT_WALLET
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletConnect;
