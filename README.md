# VoteTrust

VoteTrust combines a Soroban voting contract with a React client for Stellar Testnet wallet operations.

## Frontend

The frontend is a Vite + React + TypeScript application. It supports:

- Freighter connection and app-session disconnect
- Testnet network enforcement
- Native XLM balance and estimated spendable balance
- Freighter-signed Testnet XLM payments
- Friendly wallet, Horizon, validation, and transaction feedback

Install dependencies and start the app:

```sh
npm install
npm run dev
```

Then open the local URL shown by Vite. Install Freighter, set it to **Testnet**, and fund an account through [Stellar Friendbot](https://friendbot.stellar.org/) before connecting.

Useful checks:

```sh
npm run typecheck
npm run lint
npm run build
```

## Soroban contract

The Rust workspace contains the `vote_trust` contract under `contracts/hello-world`. With the Rust and Cargo toolchain installed, run:

```sh
cargo test
```

The application never asks for or stores a Stellar secret key. Freighter signs transactions, and all wallet functionality is pinned to Stellar Testnet.
