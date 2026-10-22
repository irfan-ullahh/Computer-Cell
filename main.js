// ===== Paste your Google Apps Script web-app URL here later =====
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz3IO1geMRJjjj5-lf2LUEtTeGZ4cVSO0ki614YhAtF1t9D58a4LL-R5VmaUKBuFfkD/exec";
const $ = id => document.getElementById(id), KEY = "csds_tickets";
const target = new Date("2026-11-14T18:00:00+05:00").getTime(), pad = n => String(n).padStart(2, "0");
(function tick() { const t = Math.max(0, target - Date.now()); const v = { d: Math.floor(t / 864e5), h: Math.floor(t % 864e5 / 36e5), m: Math.floor(t % 36e5 / 6e4), s: Math.floor(t % 6e4 / 1e3) }; for (const k in v) $(k).textContent = pad(v[k]); setTimeout(tick, 1000); })();

// scroll reveal (staggered) + glass spotlight + ticket tilt
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.style.transitionDelay = (e.target.dataset.i || 0) * 90 + "ms"; e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
document.querySelectorAll(".rv").forEach((el, i) => { el.dataset.i = i % 3; io.observe(el); });
document.addEventListener("pointermove", e => { const g = e.target.closest && e.target.closest(".glass"); if (g) { const r = g.getBoundingClientRect(); g.style.setProperty("--mx", e.clientX - r.left + "px"); g.style.setProperty("--my", e.clientY - r.top + "px"); } });
const tl = $("tilt"); tl.addEventListener("pointermove", e => { const r = tl.getBoundingClientRect(); tl.style.transform = `perspective(800px) rotateY(${((e.clientX - r.left) / r.width - .5) * 14}deg) rotateX(${(.5 - (e.clientY - r.top) / r.height) * 14}deg)`; }); tl.addEventListener("pointerleave", () => tl.style.transform = "");

// storage helpers (per-browser; swap for Google Sheets lookup)
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
const save = a => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { } };
const toB64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result.split(",")[1]); r.onerror = no; r.readAsDataURL(f); });
const makeId = () => "CSDS-" + Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, "0")).join("").toUpperCase();

function toast(t, m) { const b = document.createElement("div"); b.className = "toast " + t; b.setAttribute("role", "alert"); b.innerHTML = "<b></b><span></span>"; b.firstChild.textContent = t === "ok" ? "Success" : "Error"; b.lastChild.textContent = m; $("toasts").appendChild(b); setTimeout(() => b.remove(), 5000); }
const RULES = {
    name: v => /^[A-Za-z][A-Za-z .'-]{2,}$/.test(v.trim()) ? "" : "Enter your full name (letters only, at least 3 characters).",
    section: v => v ? "" : "Select your section.",
    semester: v => v ? "" : "Select your semester.",
    cnic: v => /^\d{5}-\d{7}-\d$/.test(v.trim()) ? "" : "Enter a valid CNIC like 12345-1234567-1.",
    phone: v => /^03\d{2}-?\d{7}$/.test(v.trim()) ? "" : "Enter a valid mobile number like 0345-1234567.",
    txn: v => /^[A-Za-z0-9-]{6,}$/.test(v.trim()) ? "" : "Enter the transaction ID from your receipt (at least 6 characters)."
};
function setErr(el, m) { el.setAttribute("aria-invalid", m ? "true" : "false"); el.style.borderColor = m ? "#f2766b" : ""; let p = el.parentNode.querySelector(".err"); if (!p) { p = document.createElement("p"); p.className = "err"; el.parentNode.appendChild(p); } p.textContent = m; }
function check(el) { let m = ""; if (el.name === "shot") { const fl = el.files[0]; m = !fl ? "Upload your payment screenshot." : !/^image\/(png|jpeg|webp)$/.test(fl.type) ? "Only JPG, PNG or WebP images are allowed." : fl.size > 5 * 1024 * 1024 ? "Screenshot is over 5 MB. Upload a smaller image." : ""; } else if (RULES[el.name]) m = RULES[el.name](el.value); setErr(el, m); return m; }
function validateAll(f) { const bad = [...f.querySelectorAll("input,select")].filter(el => check(el)); if (bad.length) bad[0].focus(); return bad.length === 0; }
$("f").addEventListener("input", e => { if (e.target.hasAttribute("aria-invalid")) check(e.target); });
$("f").addEventListener("change", e => check(e.target));
$("f").addEventListener("blur", e => { if (e.target.name) check(e.target); }, true);
$("f").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.target, msg = $("msg"), go = $("go"); msg.style.color = "#f2a5a5";
    if (!validateAll(f)) { msg.textContent = "Please fix the highlighted fields and submit again."; toast("err", "Some fields need your attention."); return; }
    const cn = f.cnic.value.trim(), tx = f.txn.value.trim().toUpperCase();
    if (load().some(x => x.cnic === cn)) { setErr(f.cnic, "This CNIC is already registered. Use Find your ticket to check its status."); toast("err", "Duplicate registration found."); f.cnic.focus(); return; }
    if (load().some(x => String(x.txn).toUpperCase() === tx)) { setErr(f.txn, "This transaction ID was already used."); toast("err", "Duplicate transaction ID."); f.txn.focus(); return; }
    const file = f.shot.files[0];
    go.disabled = true; go.textContent = "Submitting…";
    const d = Object.fromEntries(new FormData(f).entries()); delete d.shot;
    d.ticketId = makeId(); d.status = "Pending verification"; d.createdAt = new Date().toISOString();
       try {
        if (GOOGLE_SCRIPT_URL) {
            // We use mode: "no-cors" so Google Apps Script accepts the data without blocking it
            await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors", 
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ ...d, screenshotName: file.name, screenshotType: file.type })
            });
        }
        
        // Save locally and show success modal
        const all = load(); all.push(d); save(all);
        $("tid").textContent = d.ticketId; 
        $("modal").classList.add("open"); 
        f.reset(); 
        f.querySelectorAll("[aria-invalid]").forEach(el => { setErr(el, ""); el.removeAttribute("aria-invalid"); }); 
        msg.style.color = "#8fe3b0"; 
        msg.textContent = "Registration submitted successfully. Ticket " + d.ticketId + " is pending verification."; 
        toast("ok", "Registration submitted. Your ticket ID is " + d.ticketId + ".");
        
    } catch (err) { 
        msg.textContent = "Submission failed. Check your connection and try again."; 
        toast("err", "Submission failed. Please try again."); 
    }
    go.disabled = false; go.textContent = "Submit registration";
});
$("cl").onclick = () => $("modal").classList.remove("open");
$("cp").onclick = () => { try { navigator.clipboard.writeText($("tid").textContent); $("cp").textContent = "Copied"; } catch (e) { } };

const DEMO = [
    { ticketId: "CSDS-DEMO01", name: "Ayesha Khan", section: "B", semester: "6", cnic: "17301-1234567-1", phone: "0345-1234567", txn: "EP90817263", status: "Confirmed", createdAt: "2026-10-20T10:30:00+05:00" },
    { ticketId: "CSDS-DEMO02", name: "Hamza Yousafzai", section: "A", semester: "4", cnic: "17301-7654321-9", phone: "0301-7654321", txn: "JC55120984", status: "Pending verification", createdAt: "2026-10-22T16:05:00+05:00" }
];
const esc = s => String(s == null ? "" : s).replace(/[<>&"]/g, "");
$("demo").hidden = !!GOOGLE_SCRIPT_URL;
document.querySelectorAll("[data-demo]").forEach(b => b.onclick = () => { $("q").value = b.dataset.demo; $("sf").requestSubmit(); });
$("sf").addEventListener("submit", async e => {
    e.preventDefault(); const q = $("q").value.trim().toUpperCase(), out = $("res"), btn = e.target.querySelector("button"); let t = null;
    if (!/^CSDS-[0-9A-Z]{4,8}$|^\d{5}-\d{7}-\d$/.test(q)) { out.innerHTML = '<div class="glass p-5 text-[#f2a5a5]" role="alert">Enter a ticket ID like CSDS-A3F29C or a CNIC like 12345-1234567-1.</div>'; toast("err", "Invalid ticket ID or CNIC."); return; }
    btn.disabled = true; btn.textContent = "Searching…"; out.innerHTML = '<div class="glass p-6 animate-pulse">Searching tickets…</div>';
    if (GOOGLE_SCRIPT_URL) { try { t = await (await fetch(GOOGLE_SCRIPT_URL + "?action=lookup&q=" + encodeURIComponent(q))).json(); } catch (err) { toast("err", "Could not reach the server. Showing saved results only."); } } else await new Promise(r => setTimeout(r, 700));
    if (!t || !t.ticketId) t = (GOOGLE_SCRIPT_URL ? load() : load().concat(DEMO)).find(x => x.ticketId === q || x.cnic === q) || null; btn.disabled = false; btn.textContent = "Search";
    if (!t) { out.innerHTML = '<div class="glass p-6" role="alert">No ticket found. Check the ID or CNIC, or message the payment desk on WhatsApp.</div>'; toast("err", "No ticket found for that ID or CNIC."); return; }
    toast("ok", "Ticket found."); const ok = /confirm/i.test(t.status), name = String(t.name).replace(/[<>&"]/g, "");
    out.innerHTML = `<div class="glass p-6 rv in"><div class="flex justify-between items-start gap-4"><div><p class="text-sm text-[color:var(--mute)]">Ticket</p><p class="disp text-2xl font-extrabold gtext">${t.ticketId}</p></div><span class="rounded-full px-3 py-1 text-sm font-semibold ${ok ? "bg-emerald-400/20 text-emerald-300" : "bg-amber-400/20 text-amber-200"}">${String(t.status).replace(/[<>&"]/g, "")}</span></div><p class="mt-4"><b>${name}</b> · Section ${String(t.section).replace(/[<>&"]/g, "")}, Semester ${String(t.semester).replace(/[<>&"]/g, "")}</p><p class="text-sm text-[color:var(--mute)] mt-1">Nov 14, 2026 · Grand Marquee, University Town</p><div class="grid sm:grid-cols-3 gap-3 mt-5 text-sm"><div><p class="text-[color:var(--mute)]">Transaction</p><b>${esc(t.txn)}</b></div><div><p class="text-[color:var(--mute)]">Phone</p><b>${esc(t.phone)}</b></div><div><p class="text-[color:var(--mute)]">Submitted</p><b>${t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"}</b></div></div><p class="mt-4 text-sm ${ok ? "text-emerald-300" : "text-amber-200"}">${ok ? "Your seat is confirmed. Show this ticket ID at the entrance." : "Your payment is still being checked. Search again later for an update."}</p></div>`;
});
