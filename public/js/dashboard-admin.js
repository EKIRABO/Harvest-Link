
const token = localStorage.getItem("hl_token");
const user = JSON.parse(localStorage.getItem("hl_user") || "null");

if (!token || !user || user.role !== "admin") {
  window.location.href = "login.html";
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
function formatMoney(n) {
  return `RWF ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function showToast(msg, ms = 3200) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("show"), ms);
}

document.getElementById("aName").textContent = user.full_name;
document.getElementById("aAvatar").textContent = user.full_name.charAt(0).toUpperCase();
document.getElementById("welcomeMsg").textContent = `Welcome back, ${user.full_name}! `;
document.getElementById("datePill").textContent = `📅 ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`;

document.querySelectorAll(".nav-link[data-target]").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    const el = document.getElementById(link.getAttribute("data-target"));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
document.querySelectorAll(".nav-link.disabled[data-soon]").forEach((link) => {
  link.addEventListener("click", () => {
    showToast(`${link.getAttribute("data-soon")} isn't built yet — no backend table/route exists for it.`);
  });
});
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("hl_token");
  localStorage.removeItem("hl_user");
  window.location.href = "login.html";
});


async function loadStats() {
  try {
    const res = await fetch("/api/admin/stats", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;

    document.getElementById("statTotalUsers").textContent = Number(data.total_users || 0).toLocaleString();
    document.getElementById("statTotalUsersSub").textContent =
      `${data.total_farmers || 0} farmers · ${data.total_buyers || 0} buyers · ${data.total_transporters || 0} transporters · ${data.suspended_count || 0} suspended`;
    document.getElementById("statListings").textContent = Number(data.active_listings || 0).toLocaleString();
    document.getElementById("statReservations").textContent = Number(data.total_reservations || 0).toLocaleString();
    document.getElementById("statTransactions").textContent = Number(data.total_transactions || 0).toLocaleString();
    document.getElementById("statTransactionsSub").textContent = formatMoney(data.total_amount || 0);
  } catch (err) {
    console.error("Could not load platform stats", err);
  }
}

async function loadUsers() {
  const role = document.getElementById("roleFilter").value;
  const active = document.getElementById("activeFilter").value;
  const search = document.getElementById("searchInput").value.trim();

  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (active !== "") params.set("active", active);
  if (search) params.set("search", search);

  try {
    const res = await fetch(`/api/admin/users?${params.toString()}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    renderUsers(data.users || []);
  } catch (err) {
    console.error("Could not load users", err);
  }
}

function renderUsers(users) {
  const tbody = document.getElementById("usersTableBody");
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="panel-empty">No users match these filters.</td></tr>`;
    return;
  }
  tbody.innerHTML = users
    .map((u) => {
      const isActive = Number(u.is_active) === 1;
      return `
      <tr>
        <td>${escapeHtml(u.full_name)}</td>
        <td><span class="role-chip ${u.role}">${escapeHtml(u.role.replace("_", " "))}</span></td>
        <td>${escapeHtml(u.email || u.phone || "—")}</td>
        <td>${escapeHtml(u.district || "—")}${u.sector ? `, ${escapeHtml(u.sector)}` : ""}</td>
        <td><span class="status-chip ${isActive ? "active" : "suspended"}">${isActive ? "Active" : "Suspended"}</span></td>
        <td>${timeAgo(u.created_at)}</td>
        <td>
          ${u.role === "admin"
            ? ""
            : isActive
              ? `<button class="mini-btn danger" onclick="suspendUser(${u.user_id})">Suspend</button>`
              : `<button class="mini-btn primary" onclick="reactivateUser(${u.user_id})">Reactivate</button>`
          }
        </td>
      </tr>`;
    })
    .join("");
}

async function suspendUser(id) {
  if (!confirm("Suspend this user? They won't be able to log in until reactivated.")) return;
  try {
    const res = await fetch(`/api/admin/users/${id}/suspend`, { method: "PUT", headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Could not suspend user."); return; }
    showToast("User suspended.");
    loadUsers();
  } catch (err) {
    console.error(err);
  }
}

async function reactivateUser(id) {
  try {
    const res = await fetch(`/api/admin/users/${id}/reactivate`, { method: "PUT", headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Could not reactivate user."); return; }
    showToast("User reactivated.");
    loadUsers();
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("roleFilter").addEventListener("change", loadUsers);
document.getElementById("activeFilter").addEventListener("change", loadUsers);
let searchTimer;
document.getElementById("searchInput").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadUsers, 350);
});


async function loadActivity() {
  try {
    const res = await fetch("/api/admin/activity", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    const rows = data.activity || [];
    const list = document.getElementById("activityList");
    list.innerHTML = rows.length
      ? rows
          .map(
            (a) => `
      <div class="activity-item">
        <div class="activity-ic">🕓</div>
        <div>
          <div>${escapeHtml(a.full_name || "System")}: ${escapeHtml(a.details || a.action)}</div>
          <div class="activity-time">${timeAgo(a.created_at)}</div>
        </div>
      </div>`
          )
          .join("")
      : `<div class="panel-empty">No activity recorded yet.</div>`;
  } catch (err) {
    console.error("Could not load activity log", err);
  }
}


loadStats();
loadUsers();
loadActivity();