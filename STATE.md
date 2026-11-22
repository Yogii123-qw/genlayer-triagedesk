# STATE.md - TriageDesk (GenLayer Projects)

## Status saat ini
- Fase: kode ditulis ulang ke gaya lama 22 Nov 2026 (header # v0.2.16, pin 1jb45aa8, gl.Contract, TreeMap telanjang) sesudah Studio menolak pin v0.4.0; uji lokal LULUS 12/12 atas file kirim yang byte-identik, tanpa swap. Repo dibuat dan di-push. Studio deploy BELUM dilakukan (butuh browser task induk).
- REFACTOR 22 Nov 2026 malam: triage() beralih dari validator kustom (run_nondet_unsafe, toleransi 1) ke gl.eq_principle.prompt_comparative dengan prinsip "selisih paling banyak 2 poin per rubrik"; prompt memakai skala 1-5 dengan contoh konkret tiap tingkat; kode _check_score tetap memakai rentang 0-10. Uji lokal 12/12 tetap lolos atas file kirim yang byte-identik. Deploy versi baru BELUM dilakukan (butuh browser task induk).
- DEPLOY ULANG 22 Nov 2026 20:40 WIB (browser task induk): kontrak BARU 0xd714326110f8e2a3a71e50a7225494776AB79955, deploy tx 0xa9ab03999d8e6a100e584a5a7132929d490b473401568f6d7314014f51ed4ab9. submit_report tx 0xfc1fe95f6a33fe884a5f35580a337858531e8324ab13301bf018d40195d3c764. triage(0) tx 0xd1fbf37a5df2bf12f1f8816dad55becfe977b8f37c159f1dbc8d67fbd024592b, FINALIZED, Reached consensus (bukan UNDETERMINED). get_report(0): status 1 (triaged), total_score 10/20 (impact 4, exploitability 3, evidence 1, reproducibility 2). Band 2 poin TERBUKTI live di Studio. Alamat lama 0x50e280BdFbD66E30f28eD8bB793b9bb28AF805C5 SUDAH TIDAK BERLAKU.
- FRONTEND 22 Nov 2026 malam: ditulis ulang penuh ke SDK resmi genlayer-js (createClient studionet + readContract/writeContract); ethers v6 DIHAPUS. config.js menunjuk alamat live baru, RPC https://studio.genlayer.com/api, chain 61999. Jalur BACA terverifikasi live (list_top + get_report menampilkan laporan nyata, skor 10/20); screenshot live 8/8 bersih, overflow 0 px, di docs/screenshots/ (6 standar) + docs/screenshots/live/ (2 detail). Jalur TULIS mengikuti pola resmi SDK tapi BELUM diuji live dari lingkungan ini (tidak ada wallet + GEN di sini). Skala tampilan diperbaiki ke /20 dan /5 (sebelumnya /40 dan /10). Demo publik: GitHub Pages https://yogii123-qw.github.io/genlayer-triagedesk/ (Vercel belum terhubung, butuh sign-in Monch).
- JANGAN SUBMIT ke portal GenLayer tanpa persetujuan Monch.

## SOP dan skill yang dibaca utuh sebelum kerja
- ~/workspace/AGENT_SOP.md (utuh)
- ~/AGENTS.md (bootloader, utuh)
- ~/workspace/AGENTS.md (aturan workspace, utuh)
- ~/workspace/multi-wallet-sop.md (utuh; tidak ada kerja multi-wallet di build ini)
- Skill: security_audit, evm_audit (pola audit diadaptasi ke Python Intelligent Contracts)
- Spesifikasi: ~/workspace/garapan-genlayer/BUILDER-IDEAS-2026-11-22.md (Ide 2, utuh)
- Blueprint mengikat: ~/workspace/garapan-genlayer/BUILD-BLUEPRINT-2026-11-22.md (utuh)
- Pola kontrak terbukti jalan: ~/workspace/garapan-genlayer/fairdeal-escrow/ (contracts/fairdeal.py, tests/test_fairdeal.py), ~/workspace/garapan-genlayer/genlayer-median-oracle/ (contracts/median_oracle.py, tests/test_median_oracle.py, STATE.md), ~/workspace/garapan-genlayer/genlayer-promptguard/ (contracts/promptguard.py, tests/test_promptguard.py, STATE.md)

## Keputusan desain (mengikuti blueprint, bukan desain sendiri)
- Konsensus triage via gl.eq_principle.prompt_comparative(get_triage, prinsip). Prinsip: dua penilaian setara bila tiap skor rubrik selisih paling banyak 2 poin; alasan boleh berbeda kata. Validator kustom lama (run_nondet_unsafe + validator_fn + SCORE_TOLERANCE = 1) dan _handle_leader_error DIHAPUS, tidak ada dead code tersisa. Exact match empat skor DITOLAK karena risiko deadlock. field_eq, numeric_tolerance, run_nondet_safe TIDAK dipakai (tidak ada di dokumen resmi).
- Prompt meminta skor integer 1-5 tiap rubrik dengan satu contoh konkret per tingkat 1, 2, 3, 4, 5 untuk tiap rubrik, supaya penilaian jujur yang berulang mendarat berdekatan. Kode _check_score tetap memakai rentang 0-10 (menerima 1-5), total_score tetap jumlah empat skor (maks 20), storage tidak di-rescale. Keputusan skala ini dicatat eksplisit: skala 1-5 hidup di prompt, 0-10 hidup di kode.
- Challenge sekali, hanya oleh pengirim, hanya sesudah triage. Alasan challenge masuk ke prompt kedua, dengan instruksi agar skor berubah hanya bila challenge menunjuk bukti di laporan atau kesalahan konkret di penilaian pertama. Challenge kedua revert.
- Reporter disimpan sebagai string hex alamat, bukan tipe Address di TreeMap, supaya tidak ada risiko tipe storage yang belum terbukti. Perbandingan pengirim memakai as_hex, sama seperti pola Median Oracle.
- list_top hanya memuat laporan yang sudah triaged, diurutkan total skor menurun, seri ke id laporan yang lebih rendah supaya urutan deterministik.
- Frontend memanggil kontrak nyata lewat alamat di frontend/config.js (SDK resmi genlayer-js, injected wallet untuk tulis). Bila alamat kosong, tampil empty state yang jelas dan tidak ada daftar laporan palsu. Tidak ada data tiruan di mana pun di aplikasi. Jalur baca end to end terverifikasi live sesudah deploy ulang 22 Nov 2026; jalur tulis mengikuti pola resmi SDK dan belum diuji live dari lingkungan ini.

## Uji lokal (genlayer-test Direct Mode, 22 Nov 2026)
- 12/12 LULUS dalam 0,50 detik sesudah refactor. Cakupan: submit dan get_report awal (status submitted, skor nol, list_top kosong), alur penuh submit-triage-list_top-get_report (skor 2/4/3/5, total 14) plus triage kedua tanpa challenge revert, challenge sekali lalu triage ulang dengan skor baru (total 20) lalu challenge kedua revert, triage dan get_report pada id yang tidak ada revert, challenge oleh bukan pengirim revert, challenge sebelum triage revert, skor 11 revert dan laporan tetap untriaged dan unlisted, output model bukan JSON revert, kata-kata prinsip band 2 poin dipatok di tes, judul kosong dan deskripsi 2001 karakter dan steps kosong dan impact claim kosong revert, list_top mengurutkan 20/14/8 dengan limit 2 dan limit 0/21 revert.
- Batasan uji: kontrak diuji sebagai file kirim yang byte-identik (header # v0.2.16, pin SDK 1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6, satu-satunya runner di bundle GenVM v0.3.0-rc7), tanpa swap header dan tanpa penyesuaian API. Pin ini terbukti bisa di-deploy di Studio pada 22 Nov 2026 (kontrak minimal gaya lama, alamat 0x05534FE75D83950cFE6C5d54486d20366576Ac1D). Bukti deploy Studio atas kontrak ini tetap menjadi cek otoritatif.
- Batasan uji tambahan: tes memakai respons model mock, bukan model live. Kualitas skor di Studio bergantung pada model yang dipakai Studio.
- Batasan uji tambahan (refactor 22 Nov 2026 malam): Direct Mode TIDAK punya handler untuk cek EqComparative, jadi run_validator() mengembalikan None untuk selisih berapa pun (diteliti: selisih 2 poin dan 3 poin sama-sama None). Band 2 poin hanya bisa dibuktikan live di Studio, lewat triage yang mencapai konsensus di sana. Tes mematok kata-kata prinsip dan mematok perilaku None ini supaya harness yang nanti mendukung EqComparative langsung ketahuan dari tes yang gagal.

## Lint
- genvm-lint check LULUS (3 checks) atas kontrak gaya lama pin 1jb45aa8, 22 Nov 2026 malam. Catatan lama soal validasi schema gagal berlaku untuk pin v0.4.0 (kzybg95x) yang sudah tidak dipakai; pin kirim sekarang ada di cache GenVM v0.3.0-rc7 linter.

## Audit teks
- README.md, DEMO-SCRIPT.md, kontrak, dan frontend: 0 em/en dash, 0 klise AI, 0 pola retoris (dicek dengan rg sesuai AGENT_SOP.md). Gitleaks: no leaks found. Tidak ada TODO, mock, atau data tiruan di kode kirim; mock hanya ada di tes lokal untuk nondet calls.

## Screenshot frontend
- Playwright headless, 6/6 bersih, overflow 0 px di semua shot. Ukuran dan tema: 360x844 gelap, 360x844 terang, 390x844 gelap, 390x844 terang, 1440x900 gelap, 1440x900 terang. Bukti di docs/screenshots/.
- Cacat yang ditemukan dan diperbaiki: putaran pertama topbar 360px bertumpuk (tag GenLayer menabrak tombol tema, tombol Connect wallet melipat dua baris). Perbaikan: tombol tema jadi ikon di bawah 480px, tag GenLayer disembunyikan di bawah 480px, tombol diberi white-space nowrap. Putaran kedua masih bertumpuk karena label teks tombol tema tetap memakan lebar; perbaikan: label disembunyikan di bawah 480px dan tombol jadi ikon saja. Putaran ketiga bersih di keenam shot, diperiksa visual satu per satu.

## Review akhir Groq (22 Nov 2026, openai/gpt-oss-120b)
- Review refactor (diff kontrak + tes, malam 22 Nov 2026): VERDICT: PUSH, 0 temuan. Review memeriksa skala 1-5 vs rentang kode 0-10 (koheren, tidak ada rescale), penghapusan validator kustom (aman, error tetap revert lewat _parse_triage), get_triage yang menormalisasi dict ke JSON string (aman untuk cek kesetaraan), determinisme (tidak ada float, semua nondet dibungkus prompt_comparative), dan dead code (SCORE_TOLERANCE dan _handle_leader_error sudah terhapus, tidak ada referensi tersisa).
- Percobaan 1 (ringkasan saja, tanpa kode): review mengarang 9 temuan atas fungsi dan file yang tidak ada di kontrak ini (validator.validate, _reset_status, list_top.py, submit_report.py, gl.utils.to_hex, gl.vm.load_module). Jejak reasoning-nya sendiri mengakui tidak punya kode dan mensimulasikan review. DITOLAK seluruhnya sebagai tidak berdasar: tidak ada satu pun nama itu di contracts/triage.py, dan klaimnya bertentangan dengan kode nyata (challenge sudah dibatasi sekali oleh flag report_challenged, list_top sudah memfilter status triaged, tidak ada setter validator).
- Percobaan 2 (kode kontrak lengkap ditempel di prompt): VERDICT SHIP, 0 temuan nyata. Review memeriksa state machine, challenge sekali, validator toleransi, parse JSON termasuk kunci hilang (parsed.get mengembalikan None lalu _check_score melempar expected error, perilaku yang dimaksud), list_top, dan storage, lalu menyimpulkan kontrak siap.
- Satu poin benar dari percobaan 1, meski bungkusannya karangan: _check_score menerima skor pecahan seperti 7.5 lalu memotong diam-diam jadi 7 lewat int(). DIPERBAIKI sebelum push: skor float yang tidak bulat sekarang revert dengan "Triage score is not an integer". Tes lokal diulang sesudah perbaikan: 12/12 tetap lolos, lint tetap 3 checks lolos.

## File aktif
- contracts/triage.py (kontrak utama)
- tests/test_triage.py (12 uji lokal)
- frontend/index.html, frontend/app.js, frontend/config.js, frontend/styles.css (aplikasi satu halaman)
- docs/screenshots/ (6 screenshot bukti + shoot.py)
- README.md, STATE.md, DEMO-SCRIPT.md, LICENSE (MIT)

## Alamat / hash
- Studio deploy versi lama (pra-refactor, 20:15 WIB 22 Nov 2026): 0x50e280BdFbD66E30f28eD8bB793b9bb28AF805C5, deploy tx 0x9e2740b9e57684ad880dac964fda65706fe5561f1b623464bbb9f54b446598a0. submit_report FINALIZED (tx 0x48cf373c04e69fdcdb7caf666d5ba6ac6c9e60b31daaab0986123588b13ac607), triage GAGAL konsensus (UNDETERMINED, validator beda di luar toleransi 1). Versi ini DIGANTI refactor di atas; deploy versi baru menunggu browser task.
- Repo GitHub: https://github.com/Yogii123-qw/genlayer-triagedesk
- Commit: b85531c (master, terverifikasi di remote)

## Perapian 22 Nov 2026
- .gitignore baru dibuat: __pycache__/, .pytest_cache/, artifacts/, *.pyc, *.log, logs/, .genlayer/, .env*.
- README ditambah bagian Verification & Test Results (12/12 tes + 6 screenshot) dan Live Deployment Proof (GenLayer Studio) dengan slot TBD termasuk Live Demo URL.
- Kontrak dan frontend tidak diubah; tes lokal diulang: 12/12 lolos.

## Langkah berikutnya
1. Serahkan ke induk untuk uji deploy Studio versi baru lewat cloud browser (akun dev Studio, bukan wallet Monch). Tempel kontrak, deploy tanpa argumen konstruktor, submit satu laporan, panggil triage sampai ada transaksi FINALIZED dan consensus tercapai, baca get_report (status 1, total_score terisi) dan list_top. Catat alamat kontrak dan tx hash.
2. Isi CONTRACT_ADDRESS, RPC_URL, CHAIN_ID, dan EXPLORER_URL di frontend/config.js dengan alamat deploy, lalu uji alur penuh dari form sampai leaderboard di browser dan rekam video demo di bawah 45 detik mengikuti DEMO-SCRIPT.md.
3. Setelah deploy Studio terverifikasi, serahkan draf submission ke Monch untuk disetujui. JANGAN submit ke Portal tanpa itu.
