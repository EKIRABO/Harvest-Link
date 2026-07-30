
const token = localStorage.getItem("hl_token");
const user = JSON.parse(localStorage.getItem("hl_user") || "null");

if (!token || !user || user.role !== "transporter") {
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
  return `${Math.floor(hrs / 24)}d ago`;
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


document.getElementById("tName").textContent = user.full_name;
document.getElementById("tAvatar").textContent = user.full_name.charAt(0).toUpperCase();
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
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("hl_token");
  localStorage.removeItem("hl_user");
  window.location.href = "login.html";
});


let myProfile = null;
let activeDeliveriesCache = [];

async function loadProfile() {
  try {
    const res = await fetch("/api/transport/me", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    myProfile = data.profile || null;
    document.getElementById("tBadge").textContent = myProfile
      ? `${escapeHtml(myProfile.vehicle_type || "Vehicle")} · ${myProfile.status || "available"}`
      : "Vehicle not registered yet";
    renderCapacityStats();
  } catch (err) {
    console.error("Could not load transport profile", err);
  }
}


function renderCapacityStats() {
  const totalCapacity = Number(myProfile?.vehicle_capacity_kg || 0);
  const usedCapacity = activeDeliveriesCache.reduce((sum, d) => sum + Number(d.quantity ?? 0), 0);
  const available = Math.max(totalCapacity - usedCapacity, 0);
  const pct = totalCapacity > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0;

  document.getElementById("statTotalCap").textContent = `${totalCapacity.toLocaleString()} kg`;
  document.getElementById("statUsedCap").textContent = `${usedCapacity.toLocaleString()} kg`;
  document.getElementById("statUsedCapSub").textContent = `${pct}% of total`;
  document.getElementById("statAvailCap").textContent = `${available.toLocaleString()} kg`;
  document.getElementById("statAvailCapSub").textContent = `${100 - pct}% remaining`;

  document.getElementById("donutPct").textContent = totalCapacity > 0 ? `${pct}%` : "—";
  document.getElementById("legendUsed").textContent = `${usedCapacity.toLocaleString()} kg`;
  document.getElementById("legendAvail").textContent = `${available.toLocaleString()} kg`;
  document.getElementById("donutEl").style.background = totalCapacity > 0
    ? `conic-gradient(var(--brand) 0% ${pct}%, #ede9fe ${pct}% 100%)`
    : "#ede9fe";
  document.getElementById("capacityHint").textContent = totalCapacity > 0
    ? `You can accept up to ${available.toLocaleString()} kg more.`
    : "Register your vehicle to start accepting requests.";
}

document.getElementById("qaUpdateCapacity").addEventListener("click", openCapacityModal);
function openCapacityModal() {
  document.getElementById("capacityMsg").classList.remove("show");
  document.getElementById("vehicle_type").value = myProfile?.vehicle_type || "";
  document.getElementById("vehicle_capacity_kg").value = myProfile?.vehicle_capacity_kg || "";
  document.getElementById("license_plate").value = myProfile?.license_plate || "";
  document.getElementById("status").value = myProfile?.status || "available";
  document.getElementById("district").value = myProfile?.district || "";
  document.getElementById("sector").value = myProfile?.sector || "";
  document.getElementById("capacityModalOverlay").classList.add("show");
}
document.getElementById("cancelCapacityBtn").addEventListener("click", () => {
  document.getElementById("capacityModalOverlay").classList.remove("show");
});
document.getElementById("capacityForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("capacityMsg");
  try {
    const res = await fetch("/api/transport/me", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        vehicle_type: document.getElementById("vehicle_type").value.trim(),
        vehicle_capacity_kg: document.getElementById("vehicle_capacity_kg").value,
        license_plate: document.getElementById("license_plate").value.trim(),
        status: document.getElementById("status").value,
        district: document.getElementById("district").value.trim(),
        sector: document.getElementById("sector").value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || "Could not update vehicle details.";
      msg.className = "inline-msg show err";
      return;
    }
    msg.textContent = "Saved.";
    msg.className = "inline-msg show ok";
    setTimeout(() => document.getElementById("capacityModalOverlay").classList.remove("show"), 700);
    loadProfile();
  } catch (err) {
    console.error(err);
  }
});


async function loadAvailableRequests() {
  try {
    const res = await fetch("/api/delivery/open", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    const rows = Array.isArray(data) ? data : data.requests || [];
    renderAvailableRequests(rows);
  } catch (err) {
    console.error("Could not load available requests", err);
  }
}

function renderAvailableRequests(rows) {
  document.getElementById("availBadge").style.display = rows.length ? "inline-flex" : "none";
  document.getElementById("availBadge").textContent = rows.length;

  const list = document.getElementById("availableList");
  if (rows.length === 0) {
    list.innerHTML = `<div class="panel-empty">No available requests right now.</div>`;
  } else {
    list.innerHTML = rows
      .map(
        (r) => `
      <div class="row-item">
        <div class="row-thumb">🌾</div>
        <div>
          <div class="ri-title">${escapeHtml(r.crop_name || "Produce")}${r.quantity ? ` — ${r.quantity} kg` : ""}</div>
          <div class="ri-meta">${escapeHtml(r.pickup_district || "?")} → ${escapeHtml(r.dropoff_district || "?")} · ${timeAgo(r.created_at)}</div>
        </div>
        <div class="ri-right">
          <button class="mini-btn primary" onclick="acceptRequest(${r.request_id})">Accept</button>
        </div>
      </div>`
      )
      .join("");
  }
  document.getElementById("availableFoot").textContent = `${rows.length} request${rows.length === 1 ? "" : "s"} available`;
}

async function acceptRequest(id) {
  try {
    const res = await fetch(`/api/delivery/${id}/accept`, { method: "PUT", headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Could not accept this request.");
      return;
    }
    showToast("Request accepted.");
    loadAvailableRequests();
    loadDeliveries();
  } catch (err) {
    console.error(err);
  }
}


async function loadDeliveries() {
  try {
    const res = await fetch("/api/delivery/mine", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    const rows = (Array.isArray(data) ? data : data.requests || []).filter((d) => d.transporter_id === user.user_id);
    activeDeliveriesCache = rows.filter((d) => ["accepted", "in_transit"].includes(d.status));
    renderActiveDeliveries(activeDeliveriesCache);
    renderHistory(rows.filter((d) => d.status === "delivered"));
    renderCapacityStats();
  } catch (err) {
    console.error("Could not load deliveries", err);
  }
}

const NEXT_STATUS = { accepted: "in_transit", in_transit: "delivered" };
const NEXT_LABEL = { accepted: "Mark In Transit", in_transit: "Mark Delivered" };

function renderActiveDeliveries(rows) {
  document.getElementById("statActive").textContent = rows.length;
  const list = document.getElementById("activeList");
  if (rows.length === 0) {
    list.innerHTML = `<div class="panel-empty">No active deliveries.</div>`;
  } else {
    list.innerHTML = rows
      .map(
        (r) => `
      <div class="row-item">
        <div class="row-thumb">🚚</div>
        <div>
          <div class="ri-title">#${r.request_id} ${escapeHtml(r.crop_name || "Produce")}</div>
          <div class="ri-meta">${escapeHtml(r.pickup_district || "?")} → ${escapeHtml(r.dropoff_district || "?")}</div>
        </div>
        <div class="ri-right">
          <span class="status-chip ${r.status}">${(r.status || "").replace("_", " ")}</span>
          ${NEXT_STATUS[r.status] ? `<button class="mini-btn primary" onclick="advanceStatus(${r.request_id}, '${NEXT_STATUS[r.status]}')">${NEXT_LABEL[r.status]}</button>` : ""}
        </div>
      </div>`
      )
      .join("");
  }
  document.getElementById("activeFoot").textContent = `${rows.length} active delivery${rows.length === 1 ? "" : "ies"}`;
}

async function advanceStatus(id, nextStatus) {
  try {
    const res = await fetch(`/api/delivery/${id}/status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Could not update delivery status.");
      return;
    }
    showToast(`Delivery marked ${nextStatus.replace("_", " ")}.`);
    loadDeliveries();
  } catch (err) {
    console.error(err);
  }
}

function renderHistory(rows) {
  const list = document.getElementById("historyList");
  if (rows.length === 0) {
    list.innerHTML = `<div class="panel-empty">No completed deliveries yet.</div>`;
    return;
  }
  list.innerHTML = rows
    .slice(0, 6)
    .map(
      (r) => `
    <div class="row-item">
      <div class="row-thumb">✅</div>
      <div>
        <div class="ri-title">#${r.request_id} ${escapeHtml(r.crop_name || "Produce")}</div>
        <div class="ri-meta">${escapeHtml(r.pickup_district || "?")} → ${escapeHtml(r.dropoff_district || "?")}${r.delivered_at ? " · " + new Date(r.delivered_at).toLocaleDateString() : ""}</div>
      </div>
      <div class="ri-right"><span class="status-chip delivered">Delivered</span></div>
    </div>`
    )
    .join("");
}

async function loadEarnings() {
  try {
    const res = await fetch("/api/payments/transporter-earnings", { headers: authHeaders() }); 
    if (!res.ok) {
      renderEarnings([], 0);
      return;
    }
    const data = await res.json();
    renderEarnings(data.earnings || [], Number(data.total_amount || data.this_month || 0));
  } catch (err) {
    console.error("Could not load earnings", err);
    renderEarnings([], 0);
  }
}

function renderEarnings(rows, thisMonth) {
  document.getElementById("statEarnings").textContent = formatMoney(thisMonth);
  document.getElementById("statEarningsSub").textContent = rows.length ? `${rows.length} payout${rows.length === 1 ? "" : "s"} this month` : "No payouts yet this month";

  const list = document.getElementById("earningsList");
  list.innerHTML = rows.length
    ? rows
        .slice(0, 8)
        .map(
          (r) => `
      <div class="row-item">
        <div class="row-thumb">💰</div>
        <div>
          <div class="ri-title">Delivery #${r.delivery_request_id}</div>
          <div class="ri-meta">${new Date(r.created_at).toLocaleDateString()}</div>
        </div>
        <div class="ri-right"><strong>${formatMoney(r.amount)}</strong></div>
      </div>`
        )
        .join("")
    : `<div class="panel-empty">No earnings recorded yet this month.</div>`;
  document.getElementById("earningsFoot").textContent = `Total this month: ${formatMoney(thisMonth)}`;
}

async function loadNotifications() {
  try {
    const res = await fetch("/api/notifications", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    const notifications = data.notifications || [];
    const unread = notifications.filter((n) => !n.is_read).length;
    [document.getElementById("notifBadge"), document.getElementById("bellIconBadge")].forEach((b) => {
      if (unread > 0) { b.textContent = unread; b.style.display = "inline-flex"; }
      else { b.style.display = "none"; }
    });
  } catch (err) {
    console.error("Could not load notifications", err);
  }
}


async function loadMessageBadge() {
  try {
    const res = await fetch("/api/messages/conversations", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    const conversations = data.conversations || [];
    const unread = conversations.filter((c) => !c.is_read && c.receiver_id === user.user_id).length;
    [document.getElementById("msgBadge"), document.getElementById("mailIconBadge")].forEach((b) => {
      if (unread > 0) { b.textContent = unread; b.style.display = "inline-flex"; }
      else { b.style.display = "none"; }
    });
  } catch (err) {
    console.error("Could not load messages", err);
  }
}

document.getElementById("qaViewAvailable").addEventListener("click", () => {
  document.getElementById("availablePanel").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.getElementById("qaViewActive").addEventListener("click", () => {
  document.getElementById("activePanel").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.getElementById("qaViewEarnings").addEventListener("click", () => {
  document.getElementById("earningsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.getElementById("bellIconBtn").addEventListener("click", () => {
  window.location.href = "notifications-admin.html";
});
document.getElementById("mailIconBtn").addEventListener("click", () => {
  window.location.href = "messages.html";
});


(async function init() {
  await loadProfile();
  await loadDeliveries(); 
  loadAvailableRequests();
  loadEarnings();
  loadNotifications();
  loadMessageBadge();
})();