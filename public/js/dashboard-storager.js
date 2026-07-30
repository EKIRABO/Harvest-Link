
const token = localStorage.getItem("hl_token");
const user = JSON.parse(localStorage.getItem("hl_user") || "null");

if (!token || !user || user.role !== "storage_provider") {
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

document.getElementById("facName").textContent = user.full_name;
document.getElementById("facAvatar").textContent = user.full_name.charAt(0).toUpperCase();
document.getElementById("welcomeMsg").textContent = `Welcome back, ${user.full_name}! `;
document.getElementById("welcomeSub").textContent = "Here's your storage overview.";
document.getElementById("datePill").textContent = `📅 ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`;


document.querySelectorAll("[data-target]").forEach((link) => {
  link.addEventListener("click", () => {
    const target = link.getAttribute("data-target");
    if (target === "none") return;
    document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
    if (link.classList.contains("nav-link")) link.classList.add("active");
    const el = document.getElementById(target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
document.querySelectorAll(".nav-link.disabled[data-soon]").forEach((link) => {
  link.addEventListener("click", () => {
    showToast(`${link.getAttribute("data-soon")} isn't built yet.`);
  });
});
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("hl_token");
  localStorage.removeItem("hl_user");
  window.location.href = "login.html";
});
document.getElementById("bellIconBtn").addEventListener("click", () => {
  document.getElementById("notifPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});


let latestTypes = [];

async function loadTypes() {
  try {
    const res = await fetch("/api/storage/types/mine", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    latestTypes = data.types || [];
    renderCapacityStats(latestTypes);
    renderTypesList(latestTypes);
  } catch (err) {
    console.error("Could not load storage types", err);
  }
}

function renderCapacityStats(types) {
  const totalCap = types.reduce((s, t) => s + Number(t.capacity_tons), 0);
  const usedCap = types.reduce((s, t) => s + Number(t.used_tons), 0);
  const availCap = totalCap - usedCap;
  const pct = totalCap > 0 ? Math.round((usedCap / totalCap) * 100) : 0;

  document.getElementById("statTotalCap").textContent = `${totalCap.toLocaleString()} kg`;
  document.getElementById("statTotalCapSub").textContent = `Across ${types.length} storage type${types.length === 1 ? "" : "s"}`;
  document.getElementById("statUsedCap").textContent = `${usedCap.toLocaleString()} kg`;
  document.getElementById("statUsedCapSub").textContent = totalCap > 0 ? `${pct}% of total` : "";
  document.getElementById("statAvailCap").textContent = `${availCap.toLocaleString()} kg`;
  document.getElementById("statAvailCapSub").textContent = totalCap > 0 ? `${100 - pct}% remaining` : "";

  document.getElementById("donutPct").textContent = totalCap > 0 ? `${pct}%` : "—";
  const donutEl = document.getElementById("donutEl");
  if (totalCap === 0) {
    donutEl.style.background = "#eee";
  } else {
    donutEl.style.background = `conic-gradient(var(--brand) 0% ${pct}%, var(--border) ${pct}% 100%)`;
  }

  const mini = document.getElementById("typeBarsMini");
  mini.innerHTML = types
    .map((t) => {
      const tPct = Number(t.capacity_tons) > 0 ? Math.min(100, (Number(t.used_tons) / Number(t.capacity_tons)) * 100) : 0;
      const cls = tPct >= 90 ? "crit" : tPct >= 70 ? "warn" : "";
      return `
      <div class="type-bar-item">
        <div class="type-bar-head"><span class="tname">${escapeHtml(t.type_name)}</span><span>${t.used_tons}/${t.capacity_tons}t</span></div>
        <div class="type-bar-track"><div class="type-bar-fill ${cls}" style="width:${tPct}%;"></div></div>
      </div>`;
    })
    .join("");
}

function renderTypesList(types) {
  const list = document.getElementById("typesList");
  const empty = document.getElementById("typesEmpty");
  if (types.length === 0) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  list.innerHTML = types
    .map((t) => {
      const tPct = Number(t.capacity_tons) > 0 ? Math.min(100, (Number(t.used_tons) / Number(t.capacity_tons)) * 100) : 0;
      const cls = tPct >= 90 ? "crit" : tPct >= 70 ? "warn" : "";
      return `
      <div class="type-bar-item">
        <div class="type-bar-head">
          <span class="tname">${escapeHtml(t.type_name)}</span>
          <span>
            ${t.used_tons}/${t.capacity_tons}t
            <button class="mini-btn" onclick="openTypeModal(${t.storage_type_id})" style="margin-left:8px;">Edit</button>
            <button class="mini-btn danger" onclick="deleteType(${t.storage_type_id})">Delete</button>
          </span>
        </div>
        <div class="type-bar-track"><div class="type-bar-fill ${cls}" style="width:${tPct}%;"></div></div>
      </div>`;
    })
    .join("");
}

async function deleteType(id) {
  if (!confirm("Remove this storage type?")) return;
  try {
    const res = await fetch(`/api/storage/types/${id}`, { method: "DELETE", headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Could not remove storage type.");
      return;
    }
    loadTypes();
  } catch (err) {
    console.error(err);
  }
}

const typeModalOverlay = document.getElementById("typeModalOverlay");
function openTypeModal(id) {
  document.getElementById("typeModalMsg").classList.remove("show");
  if (id) {
    const t = latestTypes.find((x) => x.storage_type_id === id);
    document.getElementById("typeModalTitle").textContent = "Edit storage type";
    document.getElementById("type_id").value = id;
    document.getElementById("type_name").value = t?.type_name || "";
    document.getElementById("type_capacity").value = t?.capacity_tons || "";
    document.getElementById("type_used").value = t?.used_tons || "";
  } else {
    document.getElementById("typeModalTitle").textContent = "Add storage type";
    document.getElementById("type_id").value = "";
    document.getElementById("type_name").value = "";
    document.getElementById("type_capacity").value = "";
    document.getElementById("type_used").value = "";
  }
  typeModalOverlay.classList.add("show");
}
document.getElementById("addTypeBtn").addEventListener("click", () => openTypeModal(null));
document.getElementById("addTypeBtnSidebar").addEventListener("click", () => openTypeModal(null));
document.getElementById("cancelTypeBtn").addEventListener("click", () => typeModalOverlay.classList.remove("show"));
document.getElementById("confirmTypeBtn").addEventListener("click", async () => {
  const msg = document.getElementById("typeModalMsg");
  const id = document.getElementById("type_id").value;
  const payload = {
    type_name: document.getElementById("type_name").value.trim(),
    capacity_tons: document.getElementById("type_capacity").value,
    used_tons: document.getElementById("type_used").value || 0,
  };
  if (!payload.type_name || !payload.capacity_tons) {
    msg.textContent = "Type name and capacity are required.";
    msg.className = "inline-msg show err";
    return;
  }
  try {
    const res = await fetch(id ? `/api/storage/types/${id}` : "/api/storage/types", {
      method: id ? "PUT" : "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || "Could not save.";
      msg.className = "inline-msg show err";
      return;
    }
    showToast(id ? "Storage type updated." : "Storage type added.");
    typeModalOverlay.classList.remove("show");
    loadTypes();
  } catch (err) {
    console.error(err);
  }
});

let latestBookings = [];

async function loadBookings() {
  try {
    const res = await fetch("/api/storage/bookings", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    latestBookings = data.bookings || [];
    renderPending(latestBookings);
    renderCurrent(latestBookings);
    renderBookingsTable(latestBookings);
    renderCollection(latestBookings);
    renderBookingStats(latestBookings);
  } catch (err) {
    console.error("Could not load bookings", err);
  }
}

function renderBookingStats(bookings) {
  const active = bookings.filter((b) => b.status === "confirmed").length;
  document.getElementById("statActiveBookings").textContent = active;
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  document.getElementById("statActiveBookingsSub").textContent = `${pendingCount} pending`;
}

function renderPending(bookings) {
  const pending = bookings.filter((b) => b.status === "pending");
  const list = document.getElementById("pendingList");
  const foot = document.getElementById("pendingFoot");
  if (pending.length === 0) {
    list.innerHTML = `<div class="panel-empty">No pending requests.</div>`;
    foot.textContent = "";
    return;
  }
  list.innerHTML = pending
    .map(
      (b) => `
    <div class="row-item">
      <div class="row-thumb">📦</div>
      <div>
        <div class="ri-title">${escapeHtml(b.farmer_name)}</div>
        <div class="ri-meta">${b.quantity_tons} tons · ${timeAgo(b.created_at)}</div>
      </div>
      <div class="ri-right">
        <button class="mini-btn primary" onclick="updateBookingStatus(${b.booking_id}, 'confirmed')">Accept</button>
        <button class="mini-btn danger" onclick="updateBookingStatus(${b.booking_id}, 'cancelled')">Decline</button>
      </div>
    </div>`
    )
    .join("");
  foot.textContent = `${pending.length} awaiting your response`;
}

function renderCurrent(bookings) {
  const current = bookings.filter((b) => b.status === "confirmed");
  const list = document.getElementById("currentList");
  if (current.length === 0) {
    list.innerHTML = `<div class="panel-empty">Nothing currently in storage.</div>`;
    return;
  }
  list.innerHTML = current
    .map(
      (b) => `
    <div class="row-item">
      <div class="row-thumb">🏬</div>
      <div>
        <div class="ri-title">${escapeHtml(b.farmer_name)}</div>
        <div class="ri-meta">${b.quantity_tons} tons · Since ${new Date(b.updated_at || b.created_at).toLocaleDateString()}</div>
      </div>
      <div class="ri-right"><span class="status-chip confirmed">In storage</span></div>
    </div>`
    )
    .join("");
}

function renderBookingsTable(bookings) {
  const tbody = document.getElementById("bookingsTableBody");
  const empty = document.getElementById("bookingsEmpty");
  if (bookings.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  tbody.innerHTML = bookings
    .map(
      (b) => `
    <tr>
      <td>${escapeHtml(b.farmer_name)}</td>
      <td>${b.quantity_tons} tons</td>
      <td><span class="status-chip ${b.status}">${b.status}</span></td>
      <td>${new Date(b.created_at).toLocaleDateString()}</td>
    </tr>`
    )
    .join("");
}

function renderCollection(bookings) {

  const ready = bookings.filter((b) => b.status === "confirmed");
  const list = document.getElementById("collectionList");
  const empty = document.getElementById("collectionEmpty");
  if (ready.length === 0) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  list.innerHTML = ready
    .map(
      (b) => `
    <div class="row-item">
      <div class="row-thumb">🚚</div>
      <div>
        <div class="ri-title">${escapeHtml(b.farmer_name)}</div>
        <div class="ri-meta">${b.quantity_tons} tons</div>
      </div>
      <div class="ri-right">
        <button class="mini-btn primary" onclick="updateBookingStatus(${b.booking_id}, 'collected')">Confirm Collection</button>
      </div>
    </div>`
    )
    .join("");
}

async function updateBookingStatus(id, status) {
  try {
    const res = await fetch(`/api/storage/bookings/${id}/status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Could not update booking.");
      return;
    }
    showToast(`Booking marked as ${status}.`);
    loadBookings();
  } catch (err) {
    console.error(err);
  }
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

    const list = document.getElementById("notifList");
    list.innerHTML = notifications.length
      ? notifications
          .slice(0, 8)
          .map((n) => `
      <div class="notif-item">
        <div class="notif-ic">🔔</div>
        <div class="notif-text">${escapeHtml(n.content)}<div class="notif-time">${timeAgo(n.created_at)}</div></div>
      </div>`).join("")
      : `<div class="panel-empty">No notifications yet.</div>`;
  } catch (err) {
    console.error("Could not load notifications", err);
  }
}

async function loadMsgBadge() {
  try {
    const res = await fetch("/api/messages/conversations", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    const unread = (data.conversations || []).filter((c) => !c.is_read && c.receiver_id === user.user_id).length;
    const badge = document.getElementById("msgBadge");
    if (unread > 0) { badge.textContent = unread; badge.style.display = "inline-flex"; }
    else { badge.style.display = "none"; }
  } catch (err) {
    console.error("Could not load conversations", err);
  }
}


async function loadEarnings() {
  try {
    const res = await fetch("/api/payments/storage-earnings", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;

    document.getElementById("statEarnings").textContent = formatMoney(data.total_this_month);
    const diff = data.total_this_month - data.total_last_month;
    document.getElementById("statEarningsSub").textContent =
      data.total_last_month > 0
        ? `${diff >= 0 ? "↑" : "↓"} ${Math.abs(Math.round((diff / data.total_last_month) * 100))}% vs last month`
        : (data.total_this_month > 0 ? "First earnings recorded" : "No earnings yet");

    document.getElementById("earnThisMonth").textContent = formatMoney(data.total_this_month);
    document.getElementById("earnLastMonth").textContent = formatMoney(data.total_last_month);
    document.getElementById("earnAllTime").textContent = formatMoney(data.total_all_time);

    const list = document.getElementById("earningsList");
    list.innerHTML = data.earnings.length
      ? data.earnings
          .slice(0, 6)
          .map(
            (e) => `
      <div class="row-item">
        <div class="row-thumb">💰</div>
        <div>
          <div class="ri-title">${escapeHtml(e.farmer_name)}</div>
          <div class="ri-meta">${new Date(e.created_at).toLocaleDateString()} · ${e.quantity_tons} tons</div>
        </div>
        <div class="ri-right"><div style="font-weight:700; font-size:12.5px;">${formatMoney(e.amount)}</div></div>
      </div>`
          )
          .join("")
      : `<div class="panel-empty">No earnings recorded this month.</div>`;
  } catch (err) {
    console.error("Could not load earnings", err);
  }
}

loadTypes();
loadBookings();
loadNotifications();
loadMsgBadge();
loadEarnings();