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

`frontend/` holds a single page app: a submit form, the leaderboard, and a detail view with rubric bars and reasons. It connects a wallet through the injected provider, with no social login. All data comes from the deployed contract through the address in `frontend/config.js`. When that address is empty, the page shows a clear empty state that says the contract is not deployed yet, and it shows no report list. There is no sample data anywhere in the app.

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

The frontend was rendered in a headless browser at 1440x900, 390x844, and 360x844, in dark and light mode. All 6 screenshots are in docs/screenshots/ and show a clean layout with no overflow and no sample data.

## Live Deployment Proof (GenLayer Studio)

Network: TBD (GenLayer Studio)
Contract Address: TBD
Deployment Transaction Hash: TBD
Consensus Execution Proof: TBD (FINALIZED transaction hash)
Live Demo URL: TBD

The slots below are for the current contract version. They are filled in after the Studio deploy and a FINALIZED write transaction are verified on the Explorer.

## Deploy it on Studio

Open Studio, create a new Intelligent Contract, paste `contracts/triage.py`, and deploy. The constructor takes no arguments. Then submit a test report, call `triage`, and read the scores back with `get_report` and `list_top`. Deploy is not done yet; it needs a browser session, and this repo does not submit anything on its own. End to end testing from the form to the leaderboard waits for that deploy.

## Limits, stated plainly

The Studio deploy has not been run yet, so the validator path on live Studio still needs that check. The local tests prove the logic with mocked model responses, not with a live model. Score quality depends on the model: a thin report can still score high if the model is generous, and a strong report can score low if the model misreads it. The challenge exists for exactly that case, but it is limited to one re-assessment per report. A reverted triage records nothing, so a report that fails triage stays untriaged and unlisted. The frontend reads and writes through a standard EVM ABI client; after the Studio deploy, the call path must be checked live before the demo video is recorded.

## License

MIT.
