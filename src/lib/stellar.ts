import * as StellarSdk from "@stellar/stellar-sdk";
import {
  getNetworkDetails,
  isConnected as isFreighterConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

export const STELLAR_NETWORK = "TESTNET" as const;
export const STELLAR_NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
export const STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org";
export const STELLAR_EXPLORER_URL = "https://stellar.expert/explorer/testnet/tx";
export const MAX_MEMO_BYTES = 28;

const server = new StellarSdk.Horizon.Server(STELLAR_HORIZON_URL);

type ApiError = { message?: string; code?: string | number };
type MaybeError = { error?: ApiError | string };

export interface BalanceDetails {
  balance: string;
  spendableBalance: string;
}

function apiError(result: unknown): string | null {
  if (!result || typeof result !== "object" || !("error" in result)) return null;
  const error = (result as MaybeError).error;
  if (!error) return null;
  return typeof error === "string" ? error : error.message ?? "Freighter returned an error.";
}

export function isValidStellarPublicKey(value: string): boolean {
  try {
    return StellarSdk.StrKey.isValidEd25519PublicKey(value.trim());
  } catch {
    return false;
  }
}

export function validateAmount(value: string): string | null {
  if (!value.trim()) return "Enter an amount.";
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(value.trim())) {
    return "Use a positive number with no more than 7 decimal places.";
  }
  if (Number(value) <= 0) return "Amount must be greater than zero.";
  return null;
}

export function validateMemo(value: string): string | null {
  if (new TextEncoder().encode(value).length > MAX_MEMO_BYTES) {
    return `Memo must be ${MAX_MEMO_BYTES} bytes or fewer.`;
  }
  return null;
}

export async function connectFreighter(): Promise<string> {
  if (typeof window === "undefined") throw new Error("Freighter is only available in a browser.");

  const connection = await isFreighterConnected();
  const connectionError = apiError(connection);
  const installed = typeof connection === "boolean"
    ? connection
    : Boolean((connection as { isConnected?: boolean }).isConnected);

  if (connectionError || !installed) {
    throw new Error("Freighter wallet is required. Install the Freighter browser extension and switch to Testnet.");
  }

  const accessResult = await requestAccess();
  const accessError = apiError(accessResult);
  if (accessError) throw new Error(accessError);

  const address = typeof accessResult === "string"
    ? accessResult
    : (accessResult as { address?: string }).address;
  if (!address || !isValidStellarPublicKey(address)) {
    throw new Error("Freighter did not return a valid Stellar account. Unlock it and try again.");
  }

  await assertTestnet();
  return address;
}

export async function assertTestnet(): Promise<void> {
  const result = await getNetworkDetails();
  const error = apiError(result);
  if (error) throw new Error(error);
  const details = result as { network?: string; networkPassphrase?: string };
  if (details.network !== STELLAR_NETWORK || details.networkPassphrase !== STELLAR_NETWORK_PASSPHRASE) {
    throw new Error("Freighter is on the wrong network. Switch Freighter to Testnet and try again.");
  }
}

export async function fetchXlmBalance(publicKey: string): Promise<BalanceDetails> {
  try {
    const [account, ledgers] = await Promise.all([
      server.loadAccount(publicKey),
      server.ledgers().order("desc").limit(1).call(),
    ]);
    const native = account.balances.find((entry) => entry.asset_type === "native");
    const balance = native?.balance ?? "0";
    const liabilities = Number(native && "selling_liabilities" in native ? native.selling_liabilities : 0);
    const ledger = ledgers.records[0];
    const baseReserve = Number(ledger?.base_reserve_in_stroops ?? 5_000_000) / 10_000_000;
    const sponsoring = Number(account.num_sponsoring ?? 0);
    const sponsored = Number(account.num_sponsored ?? 0);
    const reserve = Math.max(0, (2 + account.subentry_count + sponsoring - sponsored) * baseReserve);
    const fee = Number(StellarSdk.BASE_FEE) / 10_000_000;
    const spendable = Math.max(0, Number(balance) - liabilities - reserve - fee);
    return { balance, spendableBalance: spendable.toFixed(7) };
  } catch (error) {
    if (getHttpStatus(error) === 404) {
      throw new Error("Your Testnet account is not funded yet. Fund it using Stellar Friendbot, then refresh balance.", { cause: error });
    }
    console.error("Unable to load Stellar balance", error);
    throw new Error("Could not load your Testnet balance. Check your connection and try again.", { cause: error });
  }
}

export async function sendXlmPayment(params: {
  publicKey: string;
  destination: string;
  amount: string;
  memo?: string;
  spendableBalance: string;
}): Promise<string> {
  const destination = params.destination.trim();
  const amount = params.amount.trim();
  const memo = params.memo?.trim() ?? "";

  if (!isValidStellarPublicKey(destination)) throw new Error("Enter a valid Stellar destination public key.");
  const amountError = validateAmount(amount);
  if (amountError) throw new Error(amountError);
  const memoError = validateMemo(memo);
  if (memoError) throw new Error(memoError);
  if (Number(amount) > Number(params.spendableBalance)) {
    throw new Error(`Insufficient spendable balance. Keep the account reserve intact (available: ${formatXlm(params.spendableBalance)} XLM).`);
  }

  await assertTestnet();

  try {
    await server.loadAccount(destination);
  } catch (error) {
    if (getHttpStatus(error) === 404) {
      throw new Error("The destination account does not exist on Testnet. Fund it first, then retry.", { cause: error });
    }
    throw new Error("Could not verify the destination account on Testnet.", { cause: error });
  }

  try {
    const sourceAccount = await server.loadAccount(params.publicKey);
    const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    }).addOperation(StellarSdk.Operation.payment({
      destination,
      asset: StellarSdk.Asset.native(),
      amount,
    }));
    if (memo) builder.addMemo(StellarSdk.Memo.text(memo));

    const transaction = builder.setTimeout(180).build();
    const signResult = await signTransaction(transaction.toXDR(), {
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      address: params.publicKey,
    });
    const signError = apiError(signResult);
    if (signError) throw new Error(signError);

    const signedTxXdr = typeof signResult === "string"
      ? signResult
      : (signResult as { signedTxXdr?: string }).signedTxXdr;
    if (!signedTxXdr) throw new Error("Freighter returned an unexpected signing response.");

    const signedTransaction = StellarSdk.TransactionBuilder.fromXDR(
      signedTxXdr,
      STELLAR_NETWORK_PASSPHRASE,
    );
    const response = await server.submitTransaction(signedTransaction);
    if (!response.hash) throw new Error("Horizon accepted the request but returned no transaction hash.");
    return response.hash;
  } catch (error) {
    if (error instanceof Error && !isTechnicalSubmissionError(error)) throw error;
    console.error("Stellar transaction failed", error);
    throw new Error(readSubmissionError(error), { cause: error });
  }
}

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
}

function isTechnicalSubmissionError(error: Error): boolean {
  return /Network Error|Request failed|timeout|status code/i.test(error.message);
}

function readSubmissionError(error: unknown): string {
  if (error && typeof error === "object") {
    const response = (error as { response?: { data?: { extras?: { result_codes?: { transaction?: string } } } } }).response;
    const code = response?.data?.extras?.result_codes?.transaction;
    if (code === "tx_insufficient_balance") return "The account has insufficient balance after its required reserve and fees.";
    if (code === "tx_bad_seq") return "The account changed while signing. Refresh and try the transaction again.";
  }
  return "The transaction could not be submitted to Stellar Testnet. Review the details and try again.";
}

export function formatXlm(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 7 }).format(amount);
}
