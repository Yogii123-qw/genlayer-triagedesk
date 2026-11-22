"""Local Direct Mode tests for TriageDesk.

NOTE ON THE SDK PIN: the shipped contract (contracts/triage.py) targets the old-style pin directly (# v0.2.16 header, py-genlayer pin 1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6), the same pin the Studio build of 22 Nov 2026 proved deployable. Local tests deploy the shipped file verbatim, with no header swap and no API replacements, so the file tested here is byte-identical to the file Studio receives. The Studio deploy remains the authoritative check.

Language model calls are mocked with direct_vm.mock_llm. The custom
validator is exercised through direct_vm.run_validator, which re-runs the
captured validator function against the current mocks, so the leader and
validator can be made to see different scores. In Direct Mode the harness
auto-parses a mock response that is valid JSON into a dict, so
_parse_triage is exercised on both dict input (mocked) and string input
(garbage responses that fail JSON parsing stay strings).
"""

from pathlib import Path

SHIPPED_PIN = "1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"

SCORES_A = (
    '{"impact": 8, "impact_reason": "Loss of user funds is severe.", '
    '"exploitability": 7, "exploitability_reason": "A crafted call triggers it.", '
    '"evidence": 6, "evidence_reason": "A log excerpt backs the claim.", '
    '"reproducibility": 9, "reproducibility_reason": "Steps are exact and ordered."}'
)
# Same as A except impact is 1 point higher: inside the tolerance of 1.
SCORES_DIFF_ONE = (
    '{"impact": 9, "impact_reason": "Loss of user funds is severe.", '
    '"exploitability": 7, "exploitability_reason": "A crafted call triggers it.", '
    '"evidence": 6, "evidence_reason": "A log excerpt backs the claim.", '
    '"reproducibility": 9, "reproducibility_reason": "Steps are exact and ordered."}'
)
# Same as A except impact is 2 points higher: outside the tolerance of 1.
SCORES_DIFF_TWO = (
    '{"impact": 10, "impact_reason": "Loss of user funds is severe.", '
    '"exploitability": 7, "exploitability_reason": "A crafted call triggers it.", '
    '"evidence": 6, "evidence_reason": "A log excerpt backs the claim.", '
    '"reproducibility": 9, "reproducibility_reason": "Steps are exact and ordered."}'
)
SCORES_LOW = (
    '{"impact": 3, "impact_reason": "Harm is limited to a display glitch.", '
    '"exploitability": 2, "exploitability_reason": "Needs an admin key to trigger.", '
    '"evidence": 4, "evidence_reason": "Only a screenshot is given.", '
    '"reproducibility": 5, "reproducibility_reason": "Steps skip the setup."}'
)
SCORES_HIGH = (
    '{"impact": 10, "impact_reason": "All funds can be drained.", '
    '"exploitability": 9, "exploitability_reason": "One public call is enough.", '
    '"evidence": 9, "evidence_reason": "A full proof of concept is attached.", '
    '"reproducibility": 10, "reproducibility_reason": "Steps are exact and ordered."}'
)
SCORES_BAD_RANGE = (
    '{"impact": 11, "impact_reason": "Too high.", '
    '"exploitability": 7, "exploitability_reason": "A crafted call triggers it.", '
    '"evidence": 6, "evidence_reason": "A log excerpt backs the claim.", '
    '"reproducibility": 9, "reproducibility_reason": "Steps are exact and ordered."}'
)
GARBAGE = "not json at all"

TITLE_A = "Reentrancy in vault withdraw"
TITLE_B = "Stale oracle price accepted"
TITLE_C = "Missing access check on pause"

DESC = "The withdraw function sends funds before updating the balance."
STEPS = "1. Deposit 1 token. 2. Call withdraw with a reentrant receiver. 3. Observe the extra payout."
IMPACT = "An attacker can drain the vault balance."


def _local_copy(tmp_path):
    # The shipped contract already targets the old-style pin, so tests
    # deploy it verbatim: no header swap, no API replacements. If the
    # header ever drifts back to a newer pin, this guard fails loudly
    # instead of silently testing a different file than Studio receives.
    src = Path("contracts/triage.py").read_text()
    assert src.startswith("# v0.2.16\n"), "shipped header drifted from v0.2.16"
    assert SHIPPED_PIN in src, "shipped header drifted from pin 1jb45aa8"
    target = tmp_path / "triage_local.py"
    target.write_text(src)
    return str(target)
def _deploy(direct_vm, direct_deploy, tmp_path):
    return direct_deploy(_local_copy(tmp_path))


def _submit(contract, title=TITLE_A):
    return contract.submit_report(title, DESC, STEPS, IMPACT)


def test_submit_and_get_report_initial(direct_vm, direct_deploy, tmp_path):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    report_id = _submit(contract)
    assert int(report_id) == 0
    report = contract.get_report(0)
    assert report["title"] == TITLE_A
    assert report["description"] == DESC
    assert report["status"] == 0
    assert report["challenged"] is False
    assert report["total_score"] == 0
    assert report["impact"] == 0
    assert contract.list_top(10)["reports"] == []
    assert contract.list_top(10)["total_reports"] == 1


def test_full_flow_submit_triage_list_top_get_report(
    direct_vm, direct_deploy, tmp_path
):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    _submit(contract)
    direct_vm.mock_llm(r"Reentrancy in vault", SCORES_A)
    result = contract.triage(0)
    assert result["impact"] == 8
    assert result["exploitability"] == 7
    assert result["evidence"] == 6
    assert result["reproducibility"] == 9
    assert result["total_score"] == 30
    assert result["status"] == 1
    assert "Loss of user funds" in result["impact_reason"]
    top = contract.list_top(10)
    assert len(top["reports"]) == 1
    assert top["reports"][0]["id"] == 0
    assert top["reports"][0]["total_score"] == 30
    report = contract.get_report(0)
    assert report["total_score"] == 30
    # A second triage without a challenge must revert.
    with direct_vm.expect_revert("already triaged"):
        contract.triage(0)


def test_challenge_once_then_retriage_second_challenge_reverts(
    direct_vm, direct_deploy, tmp_path
):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    _submit(contract)
    direct_vm.mock_llm(r"Reentrancy in vault", SCORES_A)
    contract.triage(0)
    challenged = contract.challenge(0, "The evidence rubric missed the attached log.")
    assert challenged["challenged"] is True
    assert challenged["status"] == 0
    assert "attached log" in challenged["challenge_reason"]
    # The re-triage prompt carries the challenge reason; the new scores win.
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r"Reentrancy in vault", SCORES_HIGH)
    result = contract.triage(0)
    assert result["total_score"] == 38
    assert result["challenged"] is True
    assert result["status"] == 1
    # A second challenge must revert: only one re-assessment is allowed.
    with direct_vm.expect_revert("already challenged once"):
        contract.challenge(0, "Try again.")


def test_triage_missing_report_reverts(direct_vm, direct_deploy, tmp_path):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    with direct_vm.expect_revert("does not exist"):
        contract.triage(0)
    with direct_vm.expect_revert("does not exist"):
        contract.get_report(5)


def test_challenge_by_non_reporter_reverts(
    direct_vm, direct_deploy, tmp_path, direct_bob
):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    _submit(contract)
    direct_vm.mock_llm(r"Reentrancy in vault", SCORES_A)
    contract.triage(0)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the reporter can challenge"):
        contract.challenge(0, "I disagree with the score.")


def test_challenge_before_triage_reverts(direct_vm, direct_deploy, tmp_path):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    _submit(contract)
    with direct_vm.expect_revert("not triaged yet"):
        contract.challenge(0, "Too early.")


def test_triage_score_out_of_range_reverts(direct_vm, direct_deploy, tmp_path):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    _submit(contract)
    direct_vm.mock_llm(r"Reentrancy in vault", SCORES_BAD_RANGE)
    with direct_vm.expect_revert("out of range"):
        contract.triage(0)
    # A reverted triage leaves the report untriaged and unlisted.
    assert contract.get_report(0)["status"] == 0
    assert contract.list_top(10)["reports"] == []


def test_triage_garbage_model_output_reverts(direct_vm, direct_deploy, tmp_path):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    _submit(contract)
    direct_vm.mock_llm(r"Reentrancy in vault", GARBAGE)
    with direct_vm.expect_revert("no JSON object"):
        contract.triage(0)


def test_validator_accepts_score_diff_one(direct_vm, direct_deploy, tmp_path):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    _submit(contract)
    direct_vm.mock_llm(r"Reentrancy in vault", SCORES_A)
    contract.triage(0)
    # Validator sees impact 9 instead of 8: a 1 point move, inside tolerance.
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r"Reentrancy in vault", SCORES_DIFF_ONE)
    assert direct_vm.run_validator() is True


def test_validator_rejects_score_diff_two(direct_vm, direct_deploy, tmp_path):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    _submit(contract)
    direct_vm.mock_llm(r"Reentrancy in vault", SCORES_A)
    contract.triage(0)
    # Validator sees impact 10 instead of 8: a 2 point move, outside tolerance.
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r"Reentrancy in vault", SCORES_DIFF_TWO)
    assert direct_vm.run_validator() is False


def test_submit_empty_and_too_long_reverts(direct_vm, direct_deploy, tmp_path):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    with direct_vm.expect_revert("1 to 100 characters"):
        contract.submit_report("", DESC, STEPS, IMPACT)
    with direct_vm.expect_revert("1 to 2000 characters"):
        contract.submit_report(TITLE_A, "x" * 2001, STEPS, IMPACT)
    with direct_vm.expect_revert("1 to 2000 characters"):
        contract.submit_report(TITLE_A, DESC, "", IMPACT)
    with direct_vm.expect_revert("1 to 500 characters"):
        contract.submit_report(TITLE_A, DESC, STEPS, "")


def test_list_top_orders_by_total_and_respects_limit(
    direct_vm, direct_deploy, tmp_path
):
    contract = _deploy(direct_vm, direct_deploy, tmp_path)
    _submit(contract, TITLE_A)
    _submit(contract, TITLE_B)
    _submit(contract, TITLE_C)
    direct_vm.mock_llm(r"Reentrancy in vault", SCORES_A)
    direct_vm.mock_llm(r"Stale oracle", SCORES_LOW)
    direct_vm.mock_llm(r"Missing access check", SCORES_HIGH)
    contract.triage(0)
    contract.triage(1)
    contract.triage(2)
    top = contract.list_top(10)
    assert [r["id"] for r in top["reports"]] == [2, 0, 1]
    assert [r["total_score"] for r in top["reports"]] == [38, 30, 14]
    assert top["total_reports"] == 3
    top_two = contract.list_top(2)
    assert [r["id"] for r in top_two["reports"]] == [2, 0]
    with direct_vm.expect_revert("Limit must be 1 to 20"):
        contract.list_top(0)
    with direct_vm.expect_revert("Limit must be 1 to 20"):
        contract.list_top(21)
