import { useState, type FormEvent, type ReactNode } from "react";
import { useStellarWallet } from "../hooks/useStellarWallet";
import {
  formatXlm,
  isValidStellarPublicKey,
  STELLAR_EXPLORER_URL,
  validateAmount,
  validateMemo,
} from "../lib/stellar";

export function StellarWalletPanel() {
  const wallet = useStellarWallet();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = !isValidStellarPublicKey(destination)
      ? "Enter a valid Stellar destination public key."
      : validateAmount(amount) ?? validateMemo(memo);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError("");
    const sent = await wallet.sendPayment(destination, amount, memo);
    if (sent) {
      setDestination("");
      setAmount("");
      setMemo("");
    }
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(wallet.publicKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="wallet-layout" aria-label="Stellar wallet">
      <article className="card wallet-card">
        <div className="card-heading">
          <span className="step">01</span>
          <div><p>Freighter wallet</p><h2>{wallet.isConnected ? "Connected" : "Connect your account"}</h2></div>
          <span className={`status-dot ${wallet.isConnected ? "online" : ""}`} aria-label={wallet.isConnected ? "Connected" : "Disconnected"} />
        </div>

        {!wallet.isConnected ? (
          <div className="connect-state">
            <div className="wallet-glyph" aria-hidden="true">✦</div>
            <p>Approve the connection in Freighter. Your secret key stays safely inside the extension.</p>
            <button className="button primary" onClick={wallet.connect} disabled={wallet.isConnecting}>
              {wallet.isConnecting ? <><Spinner /> Connecting…</> : "Connect Freighter Wallet"}
            </button>
            <a href="https://www.freighter.app/" target="_blank" rel="noreferrer">Don’t have Freighter? Install it ↗</a>
          </div>
        ) : (
          <>
            <div className="account-block">
              <span>Active public key</span>
              <div><code title={wallet.publicKey}>{truncate(wallet.publicKey)}</code><button className="icon-button" onClick={copyAddress} aria-label="Copy wallet address">{copied ? "Copied" : "Copy"}</button></div>
            </div>
            <div className="balance-block" aria-live="polite">
              <div><span>Available balance</span><strong>{wallet.isLoadingBalance ? "Loading…" : wallet.balance ? formatXlm(wallet.balance) : "—"} <small>XLM</small></strong></div>
              <button className="icon-button" onClick={wallet.refreshBalance} disabled={wallet.isLoadingBalance}>↻ Refresh</button>
              {wallet.spendableBalance && <p>Estimated spendable: {formatXlm(wallet.spendableBalance)} XLM after reserve and fee.</p>}
            </div>
            <button className="button secondary" onClick={wallet.disconnect}>Disconnect this session</button>
          </>
        )}
        {wallet.error && <Notice kind="error">{wallet.error}</Notice>}
      </article>

      <article className={`card send-card ${!wallet.isConnected ? "muted" : ""}`}>
        <div className="card-heading">
          <span className="step">02</span>
          <div><p>Testnet payment</p><h2>Send XLM</h2></div>
        </div>
        <form onSubmit={submit} noValidate>
          <label>Destination public key<input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="G…" autoComplete="off" spellCheck={false} disabled={!wallet.isConnected || wallet.isSending} /></label>
          <div className="form-row">
            <label>Amount (XLM)<input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.0000000" inputMode="decimal" disabled={!wallet.isConnected || wallet.isSending} /></label>
            <label>Memo <span>optional</span><input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Up to 28 bytes" maxLength={28} disabled={!wallet.isConnected || wallet.isSending} /></label>
          </div>
          {(formError || wallet.txError) && <Notice kind="error">{formError || wallet.txError}</Notice>}
          {wallet.txStatus === "pending" && <Notice kind="pending"><Spinner /> Waiting for Freighter and Testnet confirmation…</Notice>}
          {wallet.txStatus === "success" && wallet.txHash && (
            <Notice kind="success">Payment confirmed. <a href={`${STELLAR_EXPLORER_URL}/${wallet.txHash}`} target="_blank" rel="noreferrer">View {truncateHash(wallet.txHash)} ↗</a></Notice>
          )}
          <button className="button primary send-button" type="submit" disabled={!wallet.isConnected || wallet.isSending}>
            {wallet.isSending ? <><Spinner /> Sending XLM…</> : wallet.isConnected ? "Review & send XLM" : "Connect wallet to send"}
          </button>
        </form>
      </article>
    </section>
  );
}

function Notice({ kind, children }: { kind: "error" | "pending" | "success"; children: ReactNode }) {
  return <div className={`notice ${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}

function Spinner() { return <span className="spinner" aria-hidden="true" />; }
function truncate(value: string) { return `${value.slice(0, 8)}…${value.slice(-8)}`; }
function truncateHash(value: string) { return `${value.slice(0, 7)}…${value.slice(-5)}`; }
