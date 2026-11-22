# STATE.md - TriageDesk (GenLayer Projects)

## Status saat ini
- Fase: kode selesai, uji lokal LULUS 12/12, lint LULUS (3 checks), audit teks 0 pelanggaran, screenshot 6/6 bersih, review akhir Groq selesai. Repo dibuat dan di-push. Studio deploy BELUM dilakukan (butuh browser task induk).
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
- Validator kustom via gl.vm.run_nondet_unsafe(leader_fn, validator_fn). Validator menjalankan ulang triage, mem-parse kedua JSON, dan menerima bila tiap skor rubrik selisih paling banyak 1 poin; skor leader yang disimpan. Exact match empat skor DITOLAK karena risiko deadlock. prompt_comparative TIDAK dipakai untuk skor. field_eq, numeric_tolerance, run_nondet_safe TIDAK dipakai (tidak ada di dokumen resmi).
- Challenge sekali, hanya oleh pengirim, hanya sesudah triage. Alasan challenge masuk ke prompt kedua, dengan instruksi agar skor berubah hanya bila challenge menunjuk bukti di laporan atau kesalahan konkret di penilaian pertama. Challenge kedua revert.
- Reporter disimpan sebagai string hex alamat, bukan tipe Address di TreeMap, supaya tidak ada risiko tipe storage yang belum terbukti. Perbandingan pengirim memakai as_hex, sama seperti pola Median Oracle.
- list_top hanya memuat laporan yang sudah triaged, diurutkan total skor menurun, seri ke id laporan yang lebih rendah supaya urutan deterministik.
- Frontend memanggil kontrak nyata lewat alamat di frontend/config.js (ethers v6, injected wallet). Bila alamat kosong, tampil empty state yang jelas dan tidak ada daftar laporan palsu. Tidak ada data tiruan di mana pun di aplikasi. Uji end to end penuh menunggu deploy Studio; tidak diklaim sudah end to end.

## Uji lokal (genlayer-test Direct Mode, 22 Nov 2026)
- 12/12 LULUS dalam 0,60 detik. Cakupan: submit dan get_report awal (status submitted, skor nol, list_top kosong), alur penuh submit-triage-list_top-get_report (skor 8/7/6/9, total 30) plus triage kedua tanpa challenge revert, challenge sekali lalu triage ulang dengan skor baru (total 38) lalu challenge kedua revert, triage dan get_report pada id yang tidak ada revert, challenge oleh bukan pengirim revert, challenge sebelum triage revert, skor 11 revert dan laporan tetap untriaged dan unlisted, output model bukan JSON revert, validator menerima selisih 1 poin, validator menolak selisih 2 poin, judul kosong dan deskripsi 2001 karakter dan steps kosong dan impact claim kosong revert, list_top mengurutkan 38/30/14 dengan limit 2 dan limit 0/21 revert.
- Batasan uji: kontrak diuji sebagai salinan yang byte-identik kecuali header (pin SDK 1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6, satu-satunya runner di bundle GenVM v0.3.0-rc7) dan dua penyesuaian API era lama (from genlayer import * sebagai ganti from genlayer.types import *, gl.Contract sebagai ganti gl.contract.Contract). Kontrak kirim tetap memakai header v0.4.0 dan pin kzybg95x1gn21dw72m7hyg0maaap04n4nx55j9yt6fkdqxtz6bz0. Bukti deploy Studio tetap menjadi cek otoritatif untuk pin kirim.
- Batasan uji tambahan: tes memakai respons model mock, bukan model live. Kualitas skor di Studio bergantung pada model yang dipakai Studio.

## Lint
- genvm-lint check LULUS (3 checks). Validasi schema linter gagal karena linter hanya punya cache GenVM v0.3.0-rc7 dan tidak ada tarball SDK untuk pin kirim: "filename 'runners/py-genlayer/kz/ybg95x1gn21dw72m7hyg0maaap04n4nx55j9yt6fkdqxtz6bz0.tar' not found". Bukan salah kontrak, template resmi wizard_of_coin.py gagal dengan pola yang sama (preseden FairDeal, Median Oracle, dan PromptGuard).

## Audit teks
- README.md, DEMO-SCRIPT.md, kontrak, dan frontend: 0 em/en dash, 0 klise AI, 0 pola retoris (dicek dengan rg sesuai AGENT_SOP.md). Gitleaks: no leaks found. Tidak ada TODO, mock, atau data tiruan di kode kirim; mock hanya ada di tes lokal untuk nondet calls.

## Screenshot frontend
- Playwright headless, 6/6 bersih, overflow 0 px di semua shot. Ukuran dan tema: 360x844 gelap, 360x844 terang, 390x844 gelap, 390x844 terang, 1440x900 gelap, 1440x900 terang. Bukti di docs/screenshots/.
- Cacat yang ditemukan dan diperbaiki: putaran pertama topbar 360px bertumpuk (tag GenLayer menabrak tombol tema, tombol Connect wallet melipat dua baris). Perbaikan: tombol tema jadi ikon di bawah 480px, tag GenLayer disembunyikan di bawah 480px, tombol diberi white-space nowrap. Putaran kedua masih bertumpuk karena label teks tombol tema tetap memakan lebar; perbaikan: label disembunyikan di bawah 480px dan tombol jadi ikon saja. Putaran ketiga bersih di keenam shot, diperiksa visual satu per satu.

## Review akhir Groq (22 Nov 2026, openai/gpt-oss-120b)
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
- Studio deploy: belum ada (menunggu browser task)
- Repo GitHub: https://github.com/Yogii123-qw/genlayer-triagedesk
- Commit: 8069609 (master, terverifikasi di remote; STATE.md ini diperbarui pada commit berikutnya)

## Langkah berikutnya
1. Serahkan ke induk untuk uji deploy Studio lewat cloud browser (akun dev Studio, bukan wallet Monch). Tempel kontrak, deploy tanpa argumen konstruktor, submit satu laporan, panggil triage sampai ada transaksi ACCEPTED dan consensus tercapai, baca get_report dan list_top. Catat alamat kontrak dan tx hash.
2. Isi CONTRACT_ADDRESS, RPC_URL, CHAIN_ID, dan EXPLORER_URL di frontend/config.js dengan alamat deploy, lalu uji alur penuh dari form sampai leaderboard di browser dan rekam video demo di bawah 45 detik mengikuti DEMO-SCRIPT.md.
3. Setelah deploy Studio terverifikasi, serahkan draf submission ke Monch untuk disetujui. JANGAN submit ke Portal tanpa itu.
