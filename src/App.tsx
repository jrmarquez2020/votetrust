import { StellarWalletPanel } from "./components/StellarWalletPanel";

export default function App() {
  return (
    <main className="shell">
      <header className="hero">
        <a className="brand" href="/" aria-label="VoteTrust home">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span>VoteTrust</span>
        </a>
        <div className="network-pill"><span /> Stellar Testnet</div>
        <div className="hero-copy">
          <p className="eyebrow">Level 1 · Wallet console</p>
          <h1>Your testnet funds,<br /><em>clearly in view.</em></h1>
          <p>Connect Freighter, inspect your XLM balance, and send a verified payment on Stellar Testnet.</p>
        </div>
      </header>
      <StellarWalletPanel />
      <footer>VoteTrust uses Stellar Testnet only. No secret keys ever leave your wallet.</footer>
    </main>
  );
}
