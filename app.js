/* TriageDesk frontend.
 *
 * Every report shown here comes from the deployed TriageDesk contract
 * through the address in config.js. When no address is configured the
 * app shows an empty state and loads nothing. There is no sample data.
 */
(function () {
  "use strict";

  var ABI = [
    "function submit_report(string title, string description, string steps, string impact_claim) returns (uint256)",
    "function triage(uint256 report_id) returns (tuple(uint256 id, string title, string description, string steps, string impact_claim, string reporter, uint256 status, bool challenged, string challenge_reason, uint256 impact, uint256 exploitability, uint256 evidence, uint256 reproducibility, string impact_reason, string exploitability_reason, string evidence_reason, string reproducibility_reason, uint256 total_score))",
    "function challenge(uint256 report_id, string reason) returns (tuple(uint256 id, string title, string description, string steps, string impact_claim, string reporter, uint256 status, bool challenged, string challenge_reason, uint256 impact, uint256 exploitability, uint256 evidence, uint256 reproducibility, string impact_reason, string exploitability_reason, string evidence_reason, string reproducibility_reason, uint256 total_score))",
    "function get_report(uint256 report_id) view returns (tuple(uint256 id, string title, string description, string steps, string impact_claim, string reporter, uint256 status, bool challenged, string challenge_reason, uint256 impact, uint256 exploitability, uint256 evidence, uint256 reproducibility, string impact_reason, string exploitability_reason, string evidence_reason, string reproducibility_reason, uint256 total_score))",
    "function list_top(uint256 limit) view returns (tuple(tuple(uint256 id, string title, string description, string steps, string impact_claim, string reporter, uint256 status, bool challenged, string challenge_reason, uint256 impact, uint256 exploitability, uint256 evidence, uint256 reproducibility, string impact_reason, string exploitability_reason, string evidence_reason, string reproducibility_reason, uint256 total_score)[] reports, uint256 total_reports))"
  ];

  var RUBRICS = [
    ["impact", "Impact"],
    ["exploitability", "Exploitability"],
    ["evidence", "Evidence"],
    ["reproducibility", "Reproducibility"]
  ];

  var cfg = window.TRIAGEDESK_CONFIG || {};
  var contractAddress = (cfg.CONTRACT_ADDRESS || "").trim();
  var hasContract = contractAddress.length > 0;
  var account = null;
  var readContract = null;
  var currentReport = null;
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function shortAddr(a) {
    if (!a) return "--";
    return a.slice(0, 6) + "..." + a.slice(-4);
  }
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add("hidden"); }, 5000);
  }

  /* Theme: stored locally, page data never is. */
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem("triagedesk-theme");
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  } catch (e) { /* storage unavailable, keep default */ }
  function syncThemeBtn() {
    $("themeIcon").textContent = root.getAttribute("data-theme") === "dark" ? "Light" : "Dark";
  }
  syncThemeBtn();
  $("themeToggle").addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("triagedesk-theme", next); } catch (e) { /* ignore */ }
    syncThemeBtn();
  });

  function setLoading(on) {
    $("listSkeleton").classList.toggle("hidden", !on);
    if (on) { $("listEmpty").classList.add("hidden"); $("reportList").innerHTML = ""; }
  }

  function renderList(reports, totalReports) {
    var list = $("reportList");
    list.innerHTML = "";
    var triaged = 0;
    var top = 0;
    reports.forEach(function (r, i) {
      if (Number(r.status) === 1) {
        triaged += 1;
        if (Number(r.total_score) > top) top = Number(r.total_score);
      }
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "report-item";
      btn.setAttribute("data-id", String(r.id));
      var badge = Number(r.status) === 1
        ? '<span class="badge badge-triaged">Triaged</span>'
        : '<span class="badge badge-pending">Awaiting triage</span>';
      btn.innerHTML =
        '<span class="rank">#' + (i + 1) + '</span>' +
        '<span class="report-score"><span class="num">' + esc(r.total_score) + '</span>' +
        '<span class="of">/ 40</span></span>' +
        '<span class="r-title">' + esc(r.title) + '</span>' +
        '<span class="r-meta">by ' + esc(shortAddr(r.reporter)) + '</span>' +
        '<span class="report-status">' + badge + '</span>';
      btn.addEventListener("click", function () { showDetail(Number(r.id)); });
      li.appendChild(btn);
      list.appendChild(li);
    });
    $("listCount").textContent = reports.length === 0
      ? "No reports yet"
      : reports.length + " report" + (reports.length === 1 ? "" : "s") + " shown";
    $("listEmpty").classList.toggle("hidden", reports.length !== 0);
    $("statTotal").textContent = String(totalReports);
    $("statTriaged").textContent = String(triaged);
    $("statTop").textContent = top > 0 ? String(top) + " / 40" : "--";
  }

  function loadReports() {
    if (!hasContract || !readContract) return;
    setLoading(true);
    $("loadError").classList.add("hidden");
    readContract.list_top(20).then(function (res) {
      setLoading(false);
      renderList(res.reports || res[0] || [], Number(res.total_reports || res[1] || 0));
    }).catch(function (err) {
      setLoading(false);
      $("loadErrorText").textContent = "The read call failed: " + (err && err.message ? err.message : err);
      $("loadError").classList.remove("hidden");
    });
  }

  function showDetail(id) {
    if (!readContract) return;
    readContract.get_report(id).then(function (r) {
      currentReport = r;
      $("detailTitle").textContent = r.title;
      $("detailReporter").textContent = shortAddr(r.reporter) + "  (" + r.reporter + ")";
      $("detailStatus").textContent = Number(r.status) === 1 ? "Triaged" : "Awaiting triage";
      $("detailTotal").textContent = Number(r.status) === 1 ? String(r.total_score) + " / 40" : "Not scored yet";
      $("detailDesc").textContent = r.description;
      $("detailSteps").textContent = r.steps;
      $("detailImpact").textContent = r.impact_claim;
      var box = $("rubricList");
      box.innerHTML = "";
      RUBRICS.forEach(function (pair) {
        var key = pair[0], label = pair[1];
        var score = Number(r[key] || 0);
        var div = document.createElement("div");
        div.className = "rubric";
        div.innerHTML =
          '<div class="rubric-head"><span>' + esc(label) + '</span>' +
          '<span class="mono">' + score + ' / 10</span></div>' +
          '<div class="rubric-bar"><div class="rubric-fill" style="width:' + (score * 10) + '%"></div></div>' +
          '<p>' + esc(r[key + "_reason"] || (Number(r.status) === 1 ? "No reason recorded." : "Not scored yet.")) + '</p>';
        box.appendChild(div);
      });
      var canChallenge = account && r.reporter &&
        account.toLowerCase() === String(r.reporter).toLowerCase() &&
        Number(r.status) === 1 && !r.challenged;
      $("challengeBox").classList.toggle("hidden", !canChallenge);
      $("triageBtn").classList.toggle("hidden", Number(r.status) === 1);
      $("triageBtn").disabled = !account;
      $("triageBtn").textContent = account ? "Run triage" : "Connect wallet to run triage";
      $("detailCard").classList.remove("hidden");
      $("detailCard").scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function (err) {
      toast("Could not load that report: " + (err && err.message ? err.message : err));
    });
  }

  $("detailClose").addEventListener("click", function () {
    $("detailCard").classList.add("hidden");
    currentReport = null;
  });
  $("retryBtn").addEventListener("click", loadReports);

  /* Wallet connection. */
  function syncConnectBtn() {
    var btn = $("connectBtn");
    if (account) {
      btn.textContent = shortAddr(account);
      $("submitBtn").disabled = false;
      $("submitBtn").textContent = "Submit report";
      $("submitNote").textContent = "Sending from " + shortAddr(account) + ". The contract stores your report on chain.";
    } else {
      btn.textContent = "Connect wallet";
      $("submitBtn").disabled = true;
      $("submitBtn").textContent = "Connect wallet to submit";
      $("submitNote").textContent = "Connect a wallet to send a report to the contract.";
    }
  }
  $("connectBtn").addEventListener("click", function () {
    if (!window.ethereum) {
      toast("No wallet found. Install MetaMask or another injected wallet first.");
      return;
    }
    window.ethereum.request({ method: "eth_requestAccounts" }).then(function (accounts) {
      account = accounts && accounts[0] ? accounts[0] : null;
      syncConnectBtn();
      if (account) toast("Connected as " + shortAddr(account) + ".");
      if (currentReport) showDetail(Number(currentReport.id));
    }).catch(function (err) {
      toast("Wallet connection failed: " + (err && err.message ? err.message : err));
    });
  });

  function writeContract() {
    if (!window.ethers || !window.ethereum) return null;
    var provider = new window.ethers.BrowserProvider(window.ethereum);
    return provider.getSigner().then(function (signer) {
      return new window.ethers.Contract(contractAddress, ABI, signer);
    });
  }

  function setFieldError(inputId, errorId, msg) {
    var input = $(inputId), err = $(errorId);
    err.textContent = msg || "";
    input.classList.toggle("invalid", !!msg);
    return !msg;
  }

  $("submitForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!account) { toast("Connect a wallet first."); return; }
    var title = $("fTitle").value.trim();
    var desc = $("fDesc").value.trim();
    var steps = $("fSteps").value.trim();
    var impact = $("fImpact").value.trim();
    var ok = true;
    ok = setFieldError("fTitle", "eTitle", title.length < 1 || title.length > 100 ? "Title must be 1 to 100 characters." : "") && ok;
    ok = setFieldError("fDesc", "eDesc", desc.length < 1 || desc.length > 2000 ? "Description must be 1 to 2000 characters." : "") && ok;
    ok = setFieldError("fSteps", "eSteps", steps.length < 1 || steps.length > 2000 ? "Steps must be 1 to 2000 characters." : "") && ok;
    ok = setFieldError("fImpact", "eImpact", impact.length < 1 || impact.length > 500 ? "Impact claim must be 1 to 500 characters." : "") && ok;
    if (!ok) return;
    var btn = $("submitBtn");
    btn.disabled = true;
    btn.textContent = "Sending...";
    writeContract().then(function (c) {
      return c.submit_report(title, desc, steps, impact);
    }).then(function (tx) {
      toast("Report sent. Transaction " + tx.hash + ". Waiting for confirmation.");
      return tx.wait();
    }).then(function (receipt) {
      var link = cfg.EXPLORER_URL ? cfg.EXPLORER_URL + "/tx/" + receipt.hash : receipt.hash;
      toast("Report confirmed on chain: " + link);
      $("submitForm").reset();
      loadReports();
    }).catch(function (err) {
      toast("Submit failed: " + (err && err.message ? err.message : err));
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = "Submit report";
    });
  });

  $("triageBtn").addEventListener("click", function () {
    if (!currentReport || !account) return;
    var btn = $("triageBtn");
    btn.disabled = true;
    btn.textContent = "Running triage...";
    writeContract().then(function (c) {
      return c.triage(Number(currentReport.id));
    }).then(function (tx) {
      toast("Triage sent. Transaction " + tx.hash + ". Waiting for confirmation.");
      return tx.wait();
    }).then(function () {
      toast("Triage confirmed. Scores are stored on chain.");
      loadReports();
      showDetail(Number(currentReport.id));
    }).catch(function (err) {
      toast("Triage failed: " + (err && err.message ? err.message : err));
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = "Run triage";
    });
  });

  $("challengeBtn").addEventListener("click", function () {
    if (!currentReport || !account) return;
    var reason = $("fChallenge").value.trim();
    if (!setFieldError("fChallenge", "eChallenge", reason.length < 1 || reason.length > 500 ? "Reason must be 1 to 500 characters." : "")) return;
    var btn = $("challengeBtn");
    btn.disabled = true;
    btn.textContent = "Sending...";
    writeContract().then(function (c) {
      return c.challenge(Number(currentReport.id), reason);
    }).then(function (tx) {
      toast("Challenge sent. Transaction " + tx.hash + ". Waiting for confirmation.");
      return tx.wait();
    }).then(function () {
      toast("Challenge confirmed. Run triage again for the re-assessment.");
      $("fChallenge").value = "";
      loadReports();
      showDetail(Number(currentReport.id));
    }).catch(function (err) {
      toast("Challenge failed: " + (err && err.message ? err.message : err));
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = "Send challenge";
    });
  });

  /* Boot. */
  syncConnectBtn();
  if (!hasContract) {
    $("deployNotice").classList.remove("hidden");
    $("listCount").textContent = "Contract not deployed";
    $("listEmpty").classList.remove("hidden");
    return;
  }
  if (typeof window.ethers === "undefined") {
    $("loadErrorText").textContent = "The ethers library failed to load from the CDN. Check the network connection and reload.";
    $("loadError").classList.remove("hidden");
    return;
  }
  try {
    var provider = new window.ethers.JsonRpcProvider(cfg.RPC_URL || undefined);
    readContract = new window.ethers.Contract(contractAddress, ABI, provider);
  } catch (err) {
    $("loadErrorText").textContent = "Could not build the contract client: " + err.message;
    $("loadError").classList.remove("hidden");
    return;
  }
  loadReports();
})();
