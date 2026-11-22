/* TriageDesk configuration.
 *
 * Fill these in after the contract is deployed in GenLayer Studio.
 * Until CONTRACT_ADDRESS is set, the app shows an honest empty state
 * and makes no fake report list. Nothing here is placeholder data.
 */
window.TRIAGEDESK_CONFIG = {
  // Address of the deployed TriageDesk contract, for example
  // "0x6465fe583c2C18F5Ef4680486588c9e8DceF50E0". Empty means not deployed yet.
  CONTRACT_ADDRESS: "",
  // Public GenLayer RPC endpoint used for read calls.
  RPC_URL: "https://genlayer-testnet.rpc.example.invalid",
  // Chain id of the network the contract is deployed on.
  CHAIN_ID: 0,
  // Block explorer base URL for transaction links, without trailing slash.
  EXPLORER_URL: ""
};
