#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    Address, BytesN, Env, Symbol,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    IsOpen,
    Registered(BytesN<32>),
    Voted(BytesN<32>),
    Candidate(Symbol),
    Tally(Symbol),
    TotalVotes,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VoteError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAdmin = 3,
    ElectionClosed = 4,
    AlreadyRegistered = 5,
    VoterNotRegistered = 6,
    AlreadyVoted = 7,
    CandidateNotFound = 8,
}

#[contract]
pub struct VoteTrust;

#[contractimpl]
impl VoteTrust {
    // Initializes the election admin.
    // The admin controls voter registration, candidate setup, and election status.
    pub fn init(env: Env, admin: Address) {
        admin.require_auth();

        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, VoteError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::IsOpen, &false);
        env.storage().instance().set(&DataKey::TotalVotes, &0u32);
    }

    // Adds a candidate that voters can vote for.
    pub fn add_candidate(env: Env, admin: Address, candidate: Symbol) {
        Self::require_admin(&env, &admin);

        env.storage()
            .persistent()
            .set(&DataKey::Candidate(candidate.clone()), &true);

        env.storage()
            .persistent()
            .set(&DataKey::Tally(candidate), &0u32);
    }

    // Registers one voter using a hashed voter ID.
    // This avoids storing the voter's real name or student number on-chain.
    pub fn register_voter(env: Env, admin: Address, voter_hash: BytesN<32>) {
        Self::require_admin(&env, &admin);

        let key = DataKey::Registered(voter_hash.clone());

        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, VoteError::AlreadyRegistered);
        }

        env.storage().persistent().set(&key, &true);
    }

    // Opens the election so registered voters can cast votes.
    pub fn open_election(env: Env, admin: Address) {
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::IsOpen, &true);
    }

    // Closes the election and prevents new votes.
    pub fn close_election(env: Env, admin: Address) {
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::IsOpen, &false);
    }

    // MVP voting transaction:
    // voter authenticates -> contract checks registration -> contract prevents double voting
    // -> contract increments candidate tally.
    pub fn cast_vote(
        env: Env,
        voter: Address,
        voter_hash: BytesN<32>,
        candidate: Symbol,
    ) {
        voter.require_auth();

        let is_open: bool = env
            .storage()
            .instance()
            .get(&DataKey::IsOpen)
            .unwrap_or(false);

        if !is_open {
            panic_with_error!(&env, VoteError::ElectionClosed);
        }

        let registered_key = DataKey::Registered(voter_hash.clone());
        if !env.storage().persistent().has(&registered_key) {
            panic_with_error!(&env, VoteError::VoterNotRegistered);
        }

        let voted_key = DataKey::Voted(voter_hash.clone());
        if env.storage().persistent().has(&voted_key) {
            panic_with_error!(&env, VoteError::AlreadyVoted);
        }

        let candidate_key = DataKey::Candidate(candidate.clone());
        if !env.storage().persistent().has(&candidate_key) {
            panic_with_error!(&env, VoteError::CandidateNotFound);
        }

        let tally_key = DataKey::Tally(candidate);
        let current_tally: u32 = env.storage().persistent().get(&tally_key).unwrap_or(0);
        env.storage().persistent().set(&tally_key, &(current_tally + 1));

        let total: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalVotes)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalVotes, &(total + 1));

        env.storage().persistent().set(&voted_key, &true);
    }

    // Returns the public vote count for one candidate.
    pub fn get_tally(env: Env, candidate: Symbol) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Tally(candidate))
            .unwrap_or(0)
    }

    // Checks if a hashed voter ID is registered.
    pub fn is_registered(env: Env, voter_hash: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Registered(voter_hash))
    }

    // Checks if a hashed voter ID already voted.
    pub fn has_voted(env: Env, voter_hash: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Voted(voter_hash))
    }

    // Returns total votes cast.
    pub fn total_votes(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalVotes)
            .unwrap_or(0)
    }

    // Returns election status.
    pub fn is_open(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::IsOpen)
            .unwrap_or(false)
    }

    fn require_admin(env: &Env, admin: &Address) {
        admin.require_auth();

        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, VoteError::NotInitialized));

        if stored_admin != *admin {
            panic_with_error!(env, VoteError::NotAdmin);
        }
    }
}

#[cfg(test)]
mod test;