# TriageDesk

TriageDesk is a bug report triage application for GenLayer, built as a Projects submission. A security researcher submits a vulnerability report. An Intelligent Contract asks a language model to score the report on four fixed rubrics, each from 0 to 10, and GenLayer validators agree on the scores before they are stored. A one page web app shows the leaderboard and the rubric scores with reasons for each report.

## How it works

A report has a title, a description, reproduction steps, and an impact claim. Calling `triage` sends the report to the language model with a fixed prompt. The model returns one JSON object with four scores and one sentence of reason per rubric. The contract parses that answer strictly. A score outside 0 to 10, a missing reason, or an answer with no JSON object fails the call.

The reporter can challenge a triaged report once. The challenge reason goes into the second prompt, and the model is told to change a score only when the challenge points at evidence already in the report or at a concrete mistake in the first assessment. A second challenge is rejected.

The leaderboard ranks triaged reports by total score, highest first. Reports that have not been triaged yet do not appear on it.

## Consensus: the custom validator

Two validators that ask the same model the same question can get scores that differ by a point on one rubric, and a strict check would fail consensus on honest answers. Exact match on all four scores was rejected for that reason, since it risks deadlock. The contract uses `gl.vm.run_nondet_unsafe` with a custom validator, the pattern the GenLayer docs call the default choice for non-deterministic work.

The validator runs the triage again itself and compares the two parsed results in code. It accepts the leader result only when every rubric score is within 1 point of its own score. The reason text is not compared. The leader scores are the ones stored. When the leader reported an expected error, for example the model returning no JSON, the validator agrees only when its own run fails with the exact same error message. Any other mismatch means disagree, which rotates the leader.

The contract never uses `prompt_comparative` for scores. The fields `field_eq` and `numeric_tolerance` and the call `run_nondet_safe` do not exist in the official docs, so they are not used anywhere.

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

`contracts/triage.py` holds the contract. `tests/test_triage.py` holds the local tests, 12 cases that cover the full flow, the one challenge rule, reverts for a missing report, a challenge from a non reporter, a challenge before triage, a score outside 0 to 10, bad model output, the validator band, empty and oversized input, and leaderboard ordering plus the limit. `frontend/` holds the app. `docs/screenshots/` holds the verified renders.

## Test it locally

The tests use genlayer-test in Direct Mode with mocked model responses. Install genlayer-test, then run pytest from the repo root:

`pytest tests/test_triage.py -q`

The test file swaps only the contract header to a locally available SDK pin. The shipped contract itself targets Studio-next, and that header stays untouched. `gl.vm.run_nondet_unsafe` and `gl.nondet.exec_prompt` are both present in the local bundle, so the custom validator path runs locally too: the leader runs through mocked model calls, and the captured validator is re-run with changed mocks to prove it accepts a score gap of 1 point and rejects a gap of 2 points.

## Deploy it on Studio

Open Studio, create a new Intelligent Contract, paste `contracts/triage.py`, and deploy. The constructor takes no arguments. Then submit a test report, call `triage`, and read the scores back with `get_report` and `list_top`. Deploy is not done yet; it needs a browser session, and this repo does not submit anything on its own. End to end testing from the form to the leaderboard waits for that deploy.

## Limits, stated plainly

The Studio deploy has not been run yet, so the validator path on live Studio still needs that check. The local tests prove the logic with mocked model responses, not with a live model. Score quality depends on the model: a thin report can still score high if the model is generous, and a strong report can score low if the model misreads it. The challenge exists for exactly that case, but it is limited to one re-assessment per report. A reverted triage records nothing, so a report that fails triage stays untriaged and unlisted. The frontend reads and writes through a standard EVM ABI client; after the Studio deploy, the call path must be checked live before the demo video is recorded.

## License

MIT.
