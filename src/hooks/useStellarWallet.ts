import { useCallback, useState } from "react";
import {
  connectFreighter,
  fetchXlmBalance,
  sendXlmPayment,
  type BalanceDetails,
} from "../lib/stellar";

export type TxStatus = "idle" | "pending" | "success" | "error";

const emptyBalance: BalanceDetails = { balance: "", spendableBalance: "" };

export function useStellarWallet() {
  const [publicKey, setPublicKey] = useState("");
  const [balanceDetails, setBalanceDetails] = useState(emptyBalance);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [txError, setTxError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");

  const refreshBalance = useCallback(async (address = publicKey) => {
    if (!address) return;
    setIsLoadingBalance(true);
    setError("");
    try {
      setBalanceDetails(await fetchXlmBalance(address));
    } catch (caught) {
      setBalanceDetails(emptyBalance);
      setError(messageFrom(caught));
    } finally {
      setIsLoadingBalance(false);
    }
  }, [publicKey]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError("");
    try {
      const address = await connectFreighter();
      setPublicKey(address);
      await refreshBalance(address);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setIsConnecting(false);
    }
  }, [refreshBalance]);

  const disconnect = useCallback(() => {
    setPublicKey("");
    setBalanceDetails(emptyBalance);
    setError("");
    setTxError("");
    setTxHash("");
    setTxStatus("idle");
  }, []);

  const sendPayment = useCallback(async (destination: string, amount: string, memo: string) => {
    if (!publicKey) {
      setTxError("Connect Freighter before sending XLM.");
      setTxStatus("error");
      return false;
    }
    setIsSending(true);
    setTxError("");
    setTxHash("");
    setTxStatus("pending");
    try {
      const hash = await sendXlmPayment({
        publicKey,
        destination,
        amount,
        memo,
        spendableBalance: balanceDetails.spendableBalance,
      });
      setTxHash(hash);
      setTxStatus("success");
      await refreshBalance(publicKey);
      return true;
    } catch (caught) {
      setTxError(messageFrom(caught));
      setTxStatus("error");
      return false;
    } finally {
      setIsSending(false);
    }
  }, [balanceDetails.spendableBalance, publicKey, refreshBalance]);

  return {
    publicKey,
    isConnected: Boolean(publicKey),
    balance: balanceDetails.balance,
    spendableBalance: balanceDetails.spendableBalance,
    isConnecting,
    isLoadingBalance,
    isSending,
    error,
    txError,
    txHash,
    txStatus,
    connect,
    disconnect,
    refreshBalance: () => refreshBalance(),
    sendPayment,
  };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Something unexpected happened. Please try again.";
}
