/* TriageDesk frontend.
 *
 * Every report shown here comes from the deployed TriageDesk contract
 * on GenLayer Studio, read through the official genlayer-js client
 * (vendored in vendor/genlayer-client.js). Reads need no wallet.
 * Writes are signed by the connected wallet through the same client.
 * When no address is configured the app shows an empty state and loads
 * nothing. There is no sample data.
 */
(function () {
  "use strict";

  var RUBRICS = [
    ["impact", "Impact"],
    ["exploitability", "Exploitability"],
    ["evidence", "Evidence"],
    ["reproducibility", "Reproducibility"]
  ];
  var MAX_RUBRIC = 5;
  var MAX_TOTAL = 20;
  var STUDIO_CHAIN_ID_HEX = "0xf22f";

  var cfg = window.TRIAGEDESK_CONFIG || {};
  var contractAddress = (cfg.CONTRACT_ADDRESS || "").trim();
  var hasContract = contractAddress.length > 0;
  var account = null;
  var readClient = null;
  var writeClient = null;
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
  function txHashOf(v) {
    if (typeof v === "string") return v;
    if (v && typeof v.hash === "string") return v.hash;
    return String(v);
  }
  function txLink(hash) {
    return cfg.EXPLORER_URL ? cfg.EXPLORER_URL + "/tx/" + hash : hash;
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
        '<span class="of">/ ' + MAX_TOTAL + '</span></span>' +
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
    $("statTop").textContent = top > 0 ? String(top) + "/" + MAX_TOTAL : "--";
  }

  function loadReports() {
    if (!hasContract || !readClient) return;
    setLoading(true);
    $("loadError").classList.add("hidden");
    readClient.readContract({ address: contractAddress, functionName: "list_top", args: [20] }).then(function (res) {
      setLoading(false);
      var reports = (res && res.reports) || (res && res[0]) || [];
      var total = Number((res && res.total_reports) || (res && res[1]) || 0);
      renderList(reports, total);
    }).catch(function (err) {
      setLoading(false);
      $("loadErrorText").textContent = "The read call failed: " + (err && err.message ? err.message : err);
      $("loadError").classList.remove("hidden");
    });
  }

  function showDetail(id) {
    if (!readClient) return;
    readClient.readContract({ address: contractAddress, functionName: "get_report", args: [id] }).then(function (r) {
      currentReport = r;
      $("detailTitle").textContent = r.title;
      $("detailReporter").textContent = shortAddr(r.reporter);
      $("detailReporterFull").textContent = r.reporter;
      $("detailStatus").textContent = Number(r.status) === 1 ? "Triaged" : "Awaiting triage";
      $("detailTotal").textContent = Number(r.status) === 1 ? String(r.total_score) + " / " + MAX_TOTAL : "Not scored yet";
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
          '<span class="mono">' + score + ' / ' + MAX_RUBRIC + '</span></div>' +
          '<div class="rubric-bar"><div class="rubric-fill" style="width:' + (score * 100 / MAX_RUBRIC) + '%"></div></div>' +
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

  /* Wallet connection. Writes are signed by MetaMask through genlayer-js,
   * which needs the wallet on the GenLayer Studio chain. */
  function getWriteClient() {
    if (!writeClient) writeClient = window.GenLayer.makeClient(account);
    return writeClient;
  }
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
  function switchToStudio() {
    if (!window.ethereum) return Promise.resolve();
    return window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIO_CHAIN_ID_HEX }]
    }).catch(function (err) {
      if (err && err.code === 4902) {
        return window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: STUDIO_CHAIN_ID_HEX,
            chainName: "GenLayer Studio",
            rpcUrls: [cfg.RPC_URL],
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            blockExplorerUrls: cfg.EXPLORER_URL ? [cfg.EXPLORER_URL] : []
          }]
        });
      }
      throw err;
    });
  }
  $("connectBtn").addEventListener("click", function () {
    if (!window.ethereum) {
      toast("No wallet found. Install MetaMask or another injected wallet first.");
      return;
    }
    window.ethereum.request({ method: "eth_requestAccounts" }).then(function (accounts) {
      account = accounts && accounts[0] ? accounts[0] : null;
      writeClient = null;
      return switchToStudio().then(function () { return account; });
    }).then(function () {
      syncConnectBtn();
      if (account) toast("Connected as " + shortAddr(account) + " on GenLayer Studio.");
      if (currentReport) showDetail(Number(currentReport.id));
    }).catch(function (err) {
      toast("Wallet connection failed: " + (err && err.message ? err.message : err));
    });
  });

  function setFieldError(inputId, errorId, msg) {
    var input = $(inputId), err = $(errorId);
    err.textContent = msg || "";
    input.classList.toggle("invalid", !!msg);
    return !msg;
  }

  function sendWrite(functionName, args, onConfirmed) {
    var client = getWriteClient();
    return client.writeContract({ address: contractAddress, functionName: functionName, args: args })
      .then(function (hash) {
        var h = txHashOf(hash);
        toast("Transaction " + h + ". Waiting for finalization.");
        return client.waitForTransactionReceipt({ hash: h, status: "FINALIZED" }).then(function () { return h; });
      })
      .then(function (h) {
        toast("Confirmed on chain: " + txLink(h));
        onConfirmed();
      });
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
    sendWrite("submit_report", [title, desc, steps, impact], function () {
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
    var id = Number(currentReport.id);
    btn.disabled = true;
    btn.textContent = "Running triage...";
    sendWrite("triage", [id], function () {
      toast("Triage confirmed. Scores are stored on chain.");
      loadReports();
      showDetail(id);
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
    var id = Number(currentReport.id);
    btn.disabled = true;
    btn.textContent = "Sending...";
    sendWrite("challenge", [id, reason], function () {
      toast("Challenge confirmed. Run triage again for the re-assessment.");
      $("fChallenge").value = "";
      loadReports();
      showDetail(id);
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
  if (typeof window.GenLayer === "undefined" || !window.GenLayer.makeClient) {
    $("loadErrorText").textContent = "The GenLayer client failed to load. Check the network connection and reload.";
    $("loadError").classList.remove("hidden");
    return;
  }
  try {
    readClient = window.GenLayer.makeClient();
  } catch (err) {
    $("loadErrorText").textContent = "Could not build the contract client: " + err.message;
    $("loadError").classList.remove("hidden");
    return;
  }
  loadReports();
})();
