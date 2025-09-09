// ============================================================================
// hooks/useWallet.ts
// ============================================================================

import { useState, useCallback } from "react";

function isValidSolanaAddress(address: string): boolean {
  const trimmed = address.trim();
  if (!trimmed || trimmed.length < 32 || trimmed.length > 44) return false;
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(trimmed);
}

function formatWalletAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.substring(0, 4)}...${address.substring(
    address.length - 4
  )}`;
}

export const useWallet = () => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [fullWalletAddress, setFullWalletAddress] = useState("");

  const connectWallet = useCallback((address: string): boolean => {
    if (!isValidSolanaAddress(address)) {
      return false;
    }

    setFullWalletAddress(address);
    setWalletAddress(formatWalletAddress(address));
    setWalletConnected(true);
    return true;
  }, []);

  const disconnectWallet = useCallback(() => {
    setWalletConnected(false);
    setWalletAddress("");
    setFullWalletAddress("");
  }, []);

  return {
    walletConnected,
    walletAddress,
    fullWalletAddress,
    connectWallet,
    disconnectWallet,
  };
};
