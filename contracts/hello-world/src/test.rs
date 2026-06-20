#[cfg(test)]
mod tests {
    use super::super::*;
    use soroban_sdk::{
        symbol_short,
        testutils::{Address as _, BytesN as _},
        Address, BytesN, Env,
    };

    fn setup() -> (Env, VoteTrustClient<'static>, Address, Address, BytesN<32>) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(VoteTrust, ());
        let client = VoteTrustClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let voter = Address::generate(&env);
        let voter_hash = BytesN::random(&env);

        client.init(&admin);
        client.add_candidate(&admin, &symbol_short!("ALICE"));
        client.register_voter(&admin, &voter_hash);
        client.open_election(&admin);

        (env, client, admin, voter, voter_hash)
    }

    #[test]
    fn test_happy_path_vote_success() {
        let (_env, client, _admin, voter, voter_hash) = setup();

        client.cast_vote(&voter, &voter_hash, &symbol_short!("ALICE"));

        assert_eq!(client.get_tally(&symbol_short!("ALICE")), 1);
        assert_eq!(client.total_votes(), 1);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #6)")]
    fn test_edge_case_duplicate_vote_fails() {
        let (_env, client, _admin, voter, voter_hash) = setup();

        client.cast_vote(&voter, &voter_hash, &symbol_short!("ALICE"));
        client.cast_vote(&voter, &voter_hash, &symbol_short!("ALICE"));
    }

    #[test]
    fn test_state_verification_after_vote() {
        let (_env, client, _admin, voter, voter_hash) = setup();

        client.cast_vote(&voter, &voter_hash, &symbol_short!("ALICE"));

        assert_eq!(client.has_voted(&voter_hash), true);
        assert_eq!(client.is_registered(&voter_hash), true);
        assert_eq!(client.is_open(), true);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #7)")]
    fn test_unknown_candidate_fails() {
        let (_env, client, _admin, voter, voter_hash) = setup();

        client.cast_vote(&voter, &voter_hash, &symbol_short!("BOB"));
    }

    #[test]
    fn test_close_election_blocks_status() {
        let (_env, client, admin, _voter, _voter_hash) = setup();

        client.close_election(&admin);

        assert_eq!(client.is_open(), false);
    }
}