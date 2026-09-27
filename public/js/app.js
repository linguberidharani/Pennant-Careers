/* ============================================================
   Pennant Careers — front-end logic
   ============================================================ */

const state = { jobs: [], loaded: false };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// escape user-supplied text before inserting as HTML (prevents stored XSS)
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");

/* ---------------- Tab routing ---------------- */
const TABS = ["home", "roles", "job", "life", "faq", "apply", "admin"];

function showTab(name, { push = true } = {}) {
  const tab = TABS.includes(name) ? name : "home";
  $$(".tab-panel").forEach((p) => p.classList.remove("is-active"));
  const panel = $("#tab-" + tab);
  if (panel) panel.classList.add("is-active");

  // nav active state (job detail keeps "roles" highlighted)
  const navKey = tab === "job" ? "roles" : tab;
  $$(".tab-link").forEach((l) => l.classList.toggle("is-active", l.dataset.tab === navKey));

  // close mobile menu
  $("#mobileMenu").classList.remove("open");
  $("#menuToggle").setAttribute("aria-expanded", "false");

  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

  if (push && location.hash !== "#" + tab) history.pushState({ tab }, "", "#" + tab);

  if (tab === "admin") loadAdmin();
}

// intercept any element with data-tab
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-tab]");
  if (!el) return;
  const tab = el.dataset.tab;
  if (!tab) return;
  // job detail links use data-job to open a specific role
  if (el.dataset.job) return; // handled separately
  e.preventDefault();
  showTab(tab);
});

window.addEventListener("popstate", () => {
  const hash = location.hash.replace("#", "");
  if (hash.startsWith("job/")) {
    openJob(hash.split("/")[1], { push: false });
  } else {
    showTab(hash || "home", { push: false });
  }
});

/* ---------------- Mobile menu ---------------- */
$("#menuToggle").addEventListener("click", () => {
  const menu = $("#mobileMenu");
  const open = menu.classList.toggle("open");
  $("#menuToggle").setAttribute("aria-expanded", String(open));
});

/* ---------------- Data ---------------- */
async function loadJobs() {
  if (state.loaded) return state.jobs;
  const res = await fetch("/api/jobs");
  state.jobs = await res.json();
  state.loaded = true;
  return state.jobs;
}

/* ---------------- Rendering: role card ---------------- */
function roleCard(job) {
  const featured = job.featured
    ? `<span class="badge-featured">Featured</span>`
    : `<span class="role-team">${job.team}</span>`;
  const tags = (job.tags || []).map((t) => `<span class="tag">${t}</span>`).join("");
  return `
    <article class="role-card ${job.featured ? "is-featured" : ""}">
      <div class="role-top">
        ${job.featured ? `<span class="role-team">${job.team}</span>` : ""}
        ${featured}
      </div>
      <h3>${job.title}</h3>
      <div class="role-meta">
        <span>📍 ${job.location}</span>
        <span>🕑 ${job.type}</span>
        <span>🎓 ${job.experience}</span>
      </div>
      <div class="role-tags">${tags}</div>
      <div class="role-foot">
        <span class="role-salary">${job.salary}</span>
        <a href="#job/${job.id}" class="btn btn-ghost" data-job="${job.id}">View details</a>
      </div>
    </article>`;
}

function renderRoles(filter = "all") {
  const list = filter === "all" ? state.jobs : state.jobs.filter((j) => j.team === filter);
  const mount = $("#rolesMount");
  mount.innerHTML = list.length
    ? list.map(roleCard).join("")
    : `<p style="color:var(--ink-soft)">No roles in this team right now — check back soon.</p>`;
}

function renderFeatured() {
  const job = state.jobs.find((j) => j.featured) || state.jobs[0];
  if (job) $("#featuredMount").innerHTML = roleCard(job);
}

/* open a job when a "View details" link is clicked */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-job]");
  if (!el) return;
  e.preventDefault();
  openJob(el.dataset.job);
});

/* ---------------- Rendering: job detail ---------------- */
async function openJob(id, { push = true } = {}) {
  const res = await fetch("/api/jobs/" + id);
  if (!res.ok) { showTab("roles"); return; }
  const job = await res.json();
  $("#jobMount").innerHTML = jobDetail(job);
  $$(".tab-panel").forEach((p) => p.classList.remove("is-active"));
  $("#tab-job").classList.add("is-active");
  $$(".tab-link").forEach((l) => l.classList.toggle("is-active", l.dataset.tab === "roles"));
  window.scrollTo({ top: 0 });
  if (push) history.pushState({ job: id }, "", "#job/" + id);
}

function jobDetail(job) {
  const banner = job.banner || {};
  const respo = (job.responsibilities || []).map((r) => `<li>${r}</li>`).join("");
  const elig = (job.eligibility || []).map((r) => `<li>${r}</li>`).join("");
  const process = (job.process || [])
    .map((p) => `<li><h4>${p.round}</h4><p>${p.detail}</p></li>`)
    .join("");
  const prep = (job.prepare || [])
    .map(
      (p) => `<div class="prep-card"><h4>${p.area}</h4><ul>${p.items.map((i) => `<li>${i}</li>`).join("")}</ul></div>`
    )
    .join("");
  const schedule = (job.schedule || [])
    .map((s) => `<tr><td>${s.time}</td><td>${s.stage}</td></tr>`)
    .join("");
  const docs = (job.documents || []).map((d) => `<li>${d}</li>`).join("");
  const walk = job.walkIn;

  return `
    <div class="job-hero">
      <div class="kicker">${banner.kicker || job.team}</div>
      <h1>${job.title}</h1>
      <p class="jh-line">${banner.line || job.overview}</p>
      <div class="jh-meta">
        <span class="jh-pill">📍 ${job.location}</span>
        <span class="jh-pill">🕑 ${job.type}</span>
        <span class="jh-pill">🎓 ${job.experience}</span>
        <span class="jh-pill">💰 ${job.salary}</span>
      </div>
      <div class="jh-actions">
        <a href="#apply" class="btn btn-primary" data-apply="${job.id}">Apply for this role</a>
      </div>
    </div>

    <div class="job-layout">
      <div class="job-main">
        <div class="job-block">
          <h2>About the role</h2>
          <p>${job.overview}</p>
        </div>

        ${respo ? `<div class="job-block"><h2>What you'll do</h2><ul class="tick-list">${respo}</ul></div>` : ""}
        ${elig ? `<div class="job-block"><h2>Who can apply</h2><ul class="tick-list">${elig}</ul></div>` : ""}
        ${process ? `<div class="job-block"><h2>Recruitment process</h2><ol class="timeline">${process}</ol></div>` : ""}
        ${prep ? `<div class="job-block"><h2>What to prepare</h2><div class="prep-grid">${prep}</div></div>` : ""}
        ${schedule ? `<div class="job-block"><h2>Walk-in schedule</h2><div class="table-wrap"><table><thead><tr><th>Time</th><th>Stage</th></tr></thead><tbody>${schedule}</tbody></table></div></div>` : ""}
      </div>

      <aside class="job-side">
        ${walk ? `
        <div class="side-card accent">
          <h3>Walk-in details</h3>
          <div class="kv">
            <div class="row"><span>Date</span><span>${walk.date}</span></div>
            <div class="row"><span>Reporting</span><span>${walk.reporting}</span></div>
            <div class="row"><span>Mode</span><span>${walk.mode}</span></div>
            <div class="row"><span>Venue</span><span>${walk.venue}</span></div>
          </div>
        </div>` : ""}

        ${docs ? `<div class="side-card"><h3>Documents to carry</h3><ul class="doc-list">${docs}</ul></div>` : ""}

        <div class="side-card">
          <h3>Ready to apply?</h3>
          <p style="color:var(--ink-soft);margin:0 0 14px;font-size:.92rem">Submit your details and we'll be in touch.</p>
          <a href="#apply" class="btn btn-primary full" data-apply="${job.id}">Apply now</a>
        </div>

        ${job.note ? `<div class="note-box">${job.note}</div>` : ""}
      </aside>
    </div>`;
}

/* clicking Apply from a job pre-selects it */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-apply]");
  if (!el) return;
  e.preventDefault();
  showTab("apply");
  const sel = $("#jobId");
  if (sel) sel.value = el.dataset.apply;
});

/* ---------------- Filters ---------------- */
function buildRoleFilters() {
  const el = $("#roleFilters");
  if (!el) return;
  const teams = [...new Set(state.jobs.map((j) => j.team))];
  // with a single team, filters add no value — hide them
  if (teams.length <= 1) { el.innerHTML = ""; el.style.display = "none"; return; }
  el.style.display = "";
  el.innerHTML =
    `<button class="chip-btn is-active" data-filter="all">All</button>` +
    teams.map((t) => `<button class="chip-btn" data-filter="${esc(t)}">${esc(t)}</button>`).join("");
}
$("#roleFilters").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip-btn");
  if (!btn) return;
  $$(".chip-btn").forEach((b) => b.classList.remove("is-active"));
  btn.classList.add("is-active");
  renderRoles(btn.dataset.filter);
});

/* ---------------- Apply dropdown + form ---------------- */
function populateApplySelect() {
  const sel = $("#jobId");
  sel.innerHTML =
    `<option value="" disabled selected>Select a role…</option>` +
    state.jobs.map((j) => `<option value="${j.id}">${j.title} — ${j.location}</option>`).join("");
}

const form = $("#applyForm");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#formMsg");
  const btn = $("#submitBtn");
  msg.textContent = "";
  msg.className = "form-msg";
  $$(".input-error", form).forEach((el) => el.classList.remove("input-error"));

  const data = Object.fromEntries(new FormData(form).entries());

  // basic client validation
  const required = ["jobId", "fullName", "email", "phone"];
  const missing = required.filter((k) => !data[k] || !String(data[k]).trim());
  if (missing.length) {
    missing.forEach((k) => { const f = form.elements[k]; if (f) f.classList.add("input-error"); });
    msg.textContent = "Please fill all required fields.";
    msg.classList.add("err");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Submitting…";
  try {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await res.json();
    if (!res.ok || !out.ok) throw new Error(out.error || "Something went wrong.");

    // success screen
    const panel = $("#tab-apply .section");
    panel.innerHTML = `
      <div class="apply-success">
        <h2>Application received ✓</h2>
        <p>Thanks, <strong>${esc(data.fullName)}</strong>. Your application for <strong>${
      esc(state.jobs.find((j) => j.id === data.jobId)?.title || "the role")
    }</strong> has been submitted.</p>
        <p>Your reference ID is</p>
        <p class="app-id">${out.id}</p>
        <p style="margin-top:18px"><a class="btn btn-ghost" href="#roles" data-tab="roles">Browse more roles</a></p>
      </div>`;
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add("err");
    btn.disabled = false;
    btn.textContent = "Submit application";
  }
});

/* ---------------- Admin (protected) ---------------- */
const STATUSES = ["Received", "Under review", "Shortlisted", "Rejected"];
const STATUS_CLASS = {
  "Received": "s-recv",
  "Under review": "s-rev",
  "Shortlisted": "s-short",
  "Rejected": "s-rej",
};
let adminApps = [];

function showAdminLogin() {
  $("#adminLogin").hidden = false;
  $("#adminPanel").hidden = true;
}
function showAdminPanel() {
  $("#adminLogin").hidden = true;
  $("#adminPanel").hidden = false;
}

// entry point when the Admin tab opens
async function loadAdmin() {
  try {
    const res = await fetch("/api/admin/me");
    if (res.ok) {
      showAdminPanel();
      await loadApplications();
    } else {
      showAdminLogin();
    }
  } catch {
    showAdminLogin();
  }
}

// login
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#loginMsg");
  const btn = $("#loginBtn");
  msg.textContent = "";
  msg.className = "form-msg";
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("#adminPass").value }),
    });
    const out = await res.json();
    if (!res.ok || !out.ok) throw new Error(out.error || "Sign in failed.");
    $("#adminPass").value = "";
    showAdminPanel();
    await loadApplications();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add("err");
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});

// logout
$("#logoutBtn").addEventListener("click", async () => {
  try { await fetch("/api/admin/logout", { method: "POST" }); } catch {}
  adminApps = [];
  showAdminLogin();
});

// load applications
async function loadApplications() {
  const body = $("#appsBody");
  body.innerHTML = `<tr><td class="empty" colspan="8">Loading…</td></tr>`;
  try {
    const res = await fetch("/api/applications");
    if (res.status === 401) { showAdminLogin(); return; }
    adminApps = await res.json();
    buildRoleFilter();
    renderApps();
  } catch {
    body.innerHTML = `<tr><td class="empty" colspan="8">Couldn't load applications.</td></tr>`;
  }
}
$("#refreshApps").addEventListener("click", loadApplications);

function buildRoleFilter() {
  const sel = $("#appRoleFilter");
  const current = sel.value || "all";
  const roles = [...new Set(adminApps.map((a) => a.jobTitle))];
  sel.innerHTML =
    `<option value="all">All roles</option>` +
    roles.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
  if ([...sel.options].some((o) => o.value === current)) sel.value = current;
}

function filteredApps() {
  const q = ($("#appSearch").value || "").toLowerCase().trim();
  const role = $("#appRoleFilter").value || "all";
  return adminApps.filter((a) => {
    const roleOk = role === "all" || a.jobTitle === role;
    const hay = `${a.fullName} ${a.email} ${a.jobTitle} ${a.phone} ${a.id}`.toLowerCase();
    return roleOk && (!q || hay.includes(q));
  });
}

function rowHtml(a) {
  const opts = STATUSES.map(
    (s) => `<option ${s === a.status ? "selected" : ""}>${s}</option>`
  ).join("");
  const link = safeUrl(a.resumeLink);
  return `
    <tr class="app-row" data-id="${esc(a.id)}">
      <td class="col-exp"><button class="exp-btn" aria-label="Toggle details">▸</button></td>
      <td class="mono">${esc(a.id)}</td>
      <td>${esc(a.fullName)}</td>
      <td>${esc(a.jobTitle)}</td>
      <td>${esc(a.email)}</td>
      <td>${esc(a.phone)}</td>
      <td><select class="status-select ${STATUS_CLASS[a.status] || "s-recv"}" data-id="${esc(a.id)}">${opts}</select></td>
      <td class="nowrap">${new Date(a.submittedAt).toLocaleString()}</td>
    </tr>
    <tr class="detail-row" data-detail="${esc(a.id)}" hidden>
      <td colspan="8">
        <div class="detail-grid">
          <div><span>College / University</span><p>${esc(a.college) || "—"}</p></div>
          <div><span>Branch</span><p>${esc(a.branch) || "—"}</p></div>
          <div><span>Graduation year</span><p>${esc(a.graduationYear) || "—"}</p></div>
          <div><span>CGPA / %</span><p>${esc(a.cgpa) || "—"}</p></div>
          <div><span>Resume</span><p>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Open link ↗</a>` : "—"}</p></div>
          <div class="full"><span>Why this role</span><p>${esc(a.coverNote) || "—"}</p></div>
        </div>
      </td>
    </tr>`;
}

function renderApps() {
  const body = $("#appsBody");
  const list = filteredApps();
  $("#appCount").textContent = `${list.length} of ${adminApps.length}`;
  if (!adminApps.length) {
    body.innerHTML = `<tr><td class="empty" colspan="8">No applications yet. Submit one from the Apply tab to test.</td></tr>`;
    return;
  }
  body.innerHTML = list.length
    ? list.map(rowHtml).join("")
    : `<tr><td class="empty" colspan="8">No matches for your search.</td></tr>`;
}

// search + filter
$("#appSearch").addEventListener("input", renderApps);
$("#appRoleFilter").addEventListener("change", renderApps);

// expand/collapse detail rows + change status (delegated)
$("#appsBody").addEventListener("click", (e) => {
  const btn = e.target.closest(".exp-btn");
  if (!btn) return;
  const row = btn.closest(".app-row");
  const detail = $(`.detail-row[data-detail="${CSS.escape(row.dataset.id)}"]`);
  const open = detail.hidden;
  detail.hidden = !open;
  btn.textContent = open ? "▾" : "▸";
});

$("#appsBody").addEventListener("change", async (e) => {
  const sel = e.target.closest(".status-select");
  if (!sel) return;
  const id = sel.dataset.id;
  const status = sel.value;
  sel.disabled = true;
  try {
    const res = await fetch("/api/applications/" + encodeURIComponent(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.status === 401) { showAdminLogin(); return; }
    const out = await res.json();
    if (!res.ok || !out.ok) throw new Error();
    // reflect locally + recolor
    const rec = adminApps.find((a) => a.id === id);
    if (rec) rec.status = status;
    sel.className = "status-select " + (STATUS_CLASS[status] || "s-recv");
  } catch {
    // revert on failure
    const rec = adminApps.find((a) => a.id === id);
    if (rec) sel.value = rec.status;
  } finally {
    sel.disabled = false;
  }
});

// export CSV
$("#exportCsv").addEventListener("click", async () => {
  try {
    const res = await fetch("/api/applications.csv");
    if (res.status === 401) { showAdminLogin(); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "applications.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {}
});

/* ---------------- FAQ ---------------- */
const FAQS = [
  { q: "Who is eligible for the 2027 fresher walk-in?", a: "B.Tech / B.E. graduates from CSE, IT, ECE, EEE and relevant branches with a good academic record, basic programming and SQL knowledge, and strong analytical and communication skills." },
  { q: "Do I need prior experience for the SQA role?", a: "No — the Associate SQA Engineer role is open to freshers. You'll be trained on testing practices, SQL validation and the BFSI/lending domain." },
  { q: "What should I carry to the walk-in?", a: "An updated resume (2 copies), your college/university ID, a government ID proof, academic certificates/mark sheets, and passport-size photographs." },
  { q: "Where and when is the walk-in?", a: "30 October 2027, reporting between 9:00 AM and 11:00 AM at Pennant Technologies, IT Park, Madhurawada, Visakhapatnam." },
  { q: "How is the salary decided?", a: "The advertised range is ₹4.0–4.6 LPA. Final compensation depends on your performance during the recruitment process and the company's offer terms." },
  { q: "Can I apply online instead of walking in?", a: "Yes — submit your details through the Apply tab. You'll receive a reference ID for your application." },
];
function renderFaq() {
  $("#faqMount").innerHTML = FAQS.map(
    (f) => `
    <div class="faq-item">
      <button class="faq-q" aria-expanded="false"><span>${f.q}</span><span class="ic" aria-hidden="true">+</span></button>
      <div class="faq-a"><p>${f.a}</p></div>
    </div>`
  ).join("");
}
$("#faqMount").addEventListener("click", (e) => {
  const q = e.target.closest(".faq-q");
  if (!q) return;
  const item = q.parentElement;
  const open = item.classList.toggle("open");
  q.setAttribute("aria-expanded", String(open));
  const a = q.nextElementSibling;
  a.style.maxHeight = open ? a.scrollHeight + "px" : "0";
});

/* ---------------- Init ---------------- */
(async function init() {
  renderFaq();
  await loadJobs();
  renderFeatured();
  buildRoleFilters();
  renderRoles();
  populateApplySelect();

  // deep link on load
  const hash = location.hash.replace("#", "");
  if (hash.startsWith("job/")) openJob(hash.split("/")[1], { push: false });
  else if (hash) showTab(hash, { push: false });
})();
