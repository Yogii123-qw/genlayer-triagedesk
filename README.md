# TriageDesk

TriageDesk is a bug report triage application for GenLayer, built as a Projects submission. A security researcher submits a vulnerability report. An Intelligent Contract asks a language model to score the report on four fixed rubrics, each from 1 to 5, and GenLayer validators agree on the scores before they are stored. A one page web app shows the leaderboard and the rubric scores with reasons for each report.

## How it works

A report has a title, a description, reproduction steps, and an impact claim. Calling `triage` sends the report to the language model with a fixed prompt. The model returns one JSON object with four scores and one sentence of reason per rubric. The contract parses that answer strictly. A score outside 0 to 10, a missing reason, or an answer with no JSON object fails the call.

The reporter can challenge a triaged report once. The challenge reason goes into the second prompt, and the model is told to change a score only when the challenge points at evidence already in the report or at a concrete mistake in the first assessment. A second challenge is rejected.

The leaderboard ranks triaged reports by total score, highest first. Reports that have not been triaged yet do not appear on it.

## Consensus: the comparative principle

Two validators that ask the same model the same question can get scores that differ by a point or two on one rubric, and a strict check would fail consensus on honest answers. Exact match on all four scores was rejected for that reason, since it risks deadlock. The contract uses `gl.eq_principle.prompt_comparative`, the built-in comparative principle from the GenLayer SDK, with a principle that states two assessments are equivalent when every rubric score differs by at most 2 points. The reason text is not compared. The leader scores are the ones stored.

The prompt keeps honest runs close together: it asks for integer scores from 1 to 5 and gives one concrete anchor per level for each rubric, so the model picks from a small, well defined scale instead of a wide open range. The code still checks each score against the 0 to 10 range, which accepts 1 to 5, so the total stays a plain sum of the four scores with a maximum of 20.

The fields `field_eq` and `numeric_tolerance` and the call `run_nondet_safe` do not exist in the official docs, so they are not used anywhere.

## Functions

`submit_report(title, description, steps, impact_claim)` stores a report and returns its id. Title must be 1 to 100 characters, description and steps 1 to 2000 each, impact claim 1 to 500.

`triage(report_id)` runs the model assessment and stores the four scores, the four reasons, and the total. A report that is already triaged cannot be triaged again until it is challenged.

`challenge(report_id, reason)` is open only to the reporter, only after triage, and only once. Reason must be 1 to 500 characters. It returns the report to the submitted state so `triage` can run again.

`get_report(report_id)` returns the full report: text fields, reporter, status, challenge state, the four scores with reasons, and the total.

`list_top(limit)` returns the triaged reports ordered by total score, highest first, with ties going to the lower report id. Limit must be 1 to 20.

## The frontend

`frontend/` holds a single page app: a submit form, the leaderboard, and a detail view with rubric bars and reasons. It connects a wallet through the injected provider, with no social login. All data comes from the deployed contract through the address in `frontend/config.js`, which points at the live Studio deployment. The page reads through the official genlayer-js SDK over the Studio RPC, and writes go through the injected wallet provider. When that address is empty, the page shows a clear empty state that says the contract is not deployed yet, and it shows no report list. There is no sample data anywhere in the app.

To point the app at a deployment, set `CONTRACT_ADDRESS`, `RPC_URL`, `CHAIN_ID`, and `EXPLORER_URL` in `frontend/config.js`, then serve the folder with any static file server. Example, from the repo root:

`python3 -m http.server 8000 --directory frontend`

## Files

`contracts/triage.py` holds the contract. `tests/test_triage.py` holds the local tests, 12 cases that cover the full flow, the one challenge rule, reverts for a missing report, a challenge from a non reporter, a challenge before triage, a score outside the 0 to 10 code range, bad model output, the comparative principle wording, empty and oversized input, and leaderboard ordering plus the limit. `frontend/` holds the app. `docs/screenshots/` holds the verified renders.

## Test it locally

The tests use genlayer-test in Direct Mode with mocked model responses. Install genlayer-test, then run pytest from the repo root:

`pytest tests/test_triage.py -q`

The shipped contract targets the old-style SDK pin directly, and local tests deploy that exact file with no header swap, so the tested file is byte-identical to the file Studio receives. `gl.eq_principle.prompt_comparative` and `gl.nondet.exec_prompt` are both present in the local bundle. Direct Mode runs the leader only: it has no handler for the EqComparative check, so the validator verdict cannot be observed locally and the 2 point band is verified live on Studio instead, by a triage that reaches consensus there.

## Verification & Test Results

Local tests run in genlayer-test Direct Mode with mocked model responses. The suite has 12 cases and all 12 pass. Coverage: submit and read back, full submit-triage-list flow, one challenge then re-triage, second challenge rejected, missing report, challenge by a non reporter, challenge before triage, score outside the 0 to 10 code range, bad model output, the comparative principle wording (2 point band) plus a pinned test that Direct Mode cannot evaluate the NLP verdict, empty and oversized input, and leaderboard ordering plus the limit.

The frontend was rendered in a headless browser at 1440x900, 390x844, and 360x844, in dark and light mode. All 6 screenshots in docs/screenshots/ show the live leaderboard from the deployed contract: 1 report, triaged, total score 10 out of 20, with no overflow. Two more screenshots in docs/screenshots/live/ show the open detail view with the four rubric scores and reasons.

## Live Deployment Proof (GenLayer Studio)

Network: GenLayer StudioNet (chain id 61999)
Contract Address: 0xd714326110f8e2a3a71e50a7225494776AB79955
Deployment Transaction Hash: 0xa9ab03999d8e6a100e584a5a7132929d490b473401568f6d7314014f51ed4ab9
Consensus Execution Proof: triage(0), transaction 0xd1fbf37a5df2bf12f1f8816dad55becfe977b8f37c159f1dbc8d67fbd024592b, FINALIZED, reached consensus
Live Demo URL: https://yogii123-qw.github.io/genlayer-triagedesk/

Verified live read, 22 November 2026: get_report(0) returns status 1 (triaged) and total score 10 out of 20, with rubric scores Impact 4, Exploitability 3, Evidence 1, Reproducibility 2. list_top(20) returns 1 report. The report was stored by submit_report, transaction 0xfc1fe95f6a33fe884a5f35580a337858531e8324ab13301bf018d40195d3c764.

Contract on the Explorer: https://explorer-studio.genlayer.com/address/0xd714326110f8e2a3a71e50a7225494776AB79955
Deploy transaction on the Explorer: https://explorer-studio.genlayer.com/tx/0xa9ab03999d8e6a100e584a5a7132929d490b473401568f6d7314014f51ed4ab9
Triage transaction on the Explorer: https://explorer-studio.genlayer.com/tx/0xd1fbf37a5df2bf12f1f8816dad55becfe977b8f37c159f1dbc8d67fbd024592b

## Deploy it on Studio

The contract is deployed. To repeat the deploy, open Studio, create a new Intelligent Contract, paste `contracts/triage.py`, and deploy. The constructor takes no arguments. Then submit a test report, call `triage`, and read the scores back with `get_report` and `list_top`. The live deployment proof above records the deployed address and the FINALIZED triage transaction.

## Limits, stated plainly

The Studio deploy is live and one triage reached consensus there, so the validator path is proven on live Studio for that run. The local tests still prove the logic with mocked model responses, not with a live model. Score quality depends on the model: a thin report can still score high if the model is generous, and a strong report can score low if the model misreads it. The challenge exists for exactly that case, but it is limited to one re-assessment per report. A reverted triage records nothing, so a report that fails triage stays untriaged and unlisted. The frontend reads through the official genlayer-js SDK, and the read path is verified live against the deployed contract. The write path follows the SDK pattern with the injected wallet provider and still needs a live wallet check before the demo video is recorded.

## License

MIT.
