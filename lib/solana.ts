import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

export function isValidSolanaAddress(address: string): boolean {
  try {
    const publicKey = new PublicKey(address);
    return PublicKey.isOnCurve(publicKey.toBytes());
  } catch {
    return false;
  }
}

export function formatWalletAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export async function getWalletBalance(address: string): Promise<number> {
  try {
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    return 0;
  }
}

export async function sendSOL(
  fromKeypair: Keypair,
  toAddress: string,
  amount: number
): Promise<string> {
  try {
    const toPublicKey = new PublicKey(toAddress);
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair],
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    );

    return signature;
  } catch (error) {
    console.error("Error sending SOL:", error);
    throw new Error(
      `Failed to send SOL: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export class PayoutService {
  private treasuryKeypair: Keypair;

  constructor(privateKeyArray: number[]) {
    this.treasuryKeypair = Keypair.fromSecretKey(
      new Uint8Array(privateKeyArray)
    );
  }

  async getTreasuryBalance(): Promise<number> {
    return await getWalletBalance(this.treasuryKeypair.publicKey.toString());
  }

  async processPayouts(
    winners: Array<{ walletAddress: string; amount: number; rank: number }>
  ) {
    const results = [];

    for (const winner of winners) {
      try {
        const signature = await sendSOL(
          this.treasuryKeypair,
          winner.walletAddress,
          winner.amount
        );

        results.push({
          rank: winner.rank,
          walletAddress: winner.walletAddress,
          amount: winner.amount,
          signature,
          success: true,
        });
      } catch (error) {
        results.push({
          rank: winner.rank,
          walletAddress: winner.walletAddress,
          amount: winner.amount,
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        });
      }
    }

    return results;
  }
}

export function calculatePrizeDistribution(prizePool: number) {
  return {
    first: prizePool * 0.6, // 60%
    second: prizePool * 0.25, // 25%
    third: prizePool * 0.15, // 15%
  };
}
