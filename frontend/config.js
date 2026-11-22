/* TriageDesk configuration.
 *
 * Live contract deployed in GenLayer Studio, 22 Nov 2026.
 * Reads go through the official genlayer-js client against the
 * GenLayer Studio network (chain id 61999).
 */
window.TRIAGEDESK_CONFIG = {
  // Address of the deployed TriageDesk contract.
  CONTRACT_ADDRESS: "0xd714326110f8e2a3a71e50a7225494776AB79955",
  // Public GenLayer Studio RPC endpoint used for read calls.
  RPC_URL: "https://studio.genlayer.com/api",
  // Chain id of the network the contract is deployed on.
  CHAIN_ID: 61999,
  // Block explorer base URL for transaction links, without trailing slash.
  EXPLORER_URL: "https://explorer-studio.genlayer.com"
};
