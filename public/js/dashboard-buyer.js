
const token = localStorage.getItem("hl_token");
const user = JSON.parse(localStorage.getItem("hl_user") || "null");

if (!token || !user || user.role !== "buyer") {
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


document.getElementById("userName").textContent = user.full_name;
document.getElementById("userAvatar").textContent = user.full_name.charAt(0).toUpperCase();
document.getElementById("welcomeMsg").textContent = `Welcome back, ${user.full_name.split(" ")[0]}! `;


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
document.getElementById("bellIconBtn").addEventListener("click", () => {
  document.getElementById("notifPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.getElementById("mailIconBtn").addEventListener("click", () => {
  document.getElementById("messagesPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

let latestReservations = [];

async function loadReservations() {
  try {
    const res = await fetch("/api/reservations/mine", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    latestReservations = data.reservations || [];
    renderReservations(latestReservations);
    renderHistory(latestReservations);
    renderStats();
  } catch (err) {
    console.error("Could not load reservations", err);
  }
}

function renderReservations(reservations) {
  const active = reservations.filter((r) => r.status === "pending" || r.status === "approved");
  document.getElementById("statActive").textContent = active.length;
  const pendingCount = active.filter((r) => r.status === "pending").length;
  document.getElementById("statActiveSub").textContent = pendingCount ? `${pendingCount} pending approval` : "None pending";

  const list = document.getElementById("reservationsList");
  if (active.length === 0) {
    list.innerHTML = `<div class="panel-empty">No active reservations. Reserve something from the marketplace below.</div>`;
    return;
  }
  list.innerHTML = active
    .map(
      (r) => `
    <div class="row-item">
      <div class="row-thumb">🌾</div>
      <div>
        <div class="ri-title">${escapeHtml(r.crop_name)}</div>
        <div class="ri-meta">${escapeHtml(r.farmer_name)} · ${r.quantity} ${escapeHtml(r.unit || "")} · ${timeAgo(r.created_at)}</div>
      </div>
      <div class="ri-right">
        <span class="status-chip ${r.status}">${r.status === "pending" ? "Pending approval" : "Approved"}</span>
        ${r.status === "approved" ? `<button class="mini-btn primary" onclick="openPayModal(${r.reservation_id}, '${escapeHtml(r.crop_name)}', ${Number(r.price_per_unit || 0)}, ${Number(r.quantity)})">Pay Now</button>` : ""}
      </div>
    </div>`
    )
    .join("");
}

function renderHistory(reservations) {
  const resolved = reservations.filter((r) => ["paid", "rejected", "expired", "cancelled"].includes(r.status));
  const list = document.getElementById("historyList");
  if (resolved.length === 0) {
    list.innerHTML = `<div class="panel-empty">No past orders yet.</div>`;
    return;
  }
  list.innerHTML = resolved
    .slice(0, 8)
    .map(
      (r) => `
    <div class="row-item">
      <div class="row-thumb">🧾</div>
      <div>
        <div class="ri-title">${escapeHtml(r.crop_name)}</div>
        <div class="ri-meta">${escapeHtml(r.farmer_name)} · ${r.quantity} ${escapeHtml(r.unit || "")} · ${new Date(r.updated_at || r.created_at).toLocaleDateString()}</div>
        ${r.status === "rejected" && r.rejection_reason ? `<div class="ri-meta" style="color:var(--red)">Reason: ${escapeHtml(r.rejection_reason)}</div>` : ""}
      </div>
      <div class="ri-right"><span class="status-chip ${r.status}">${r.status}</span></div>
    </div>`
    )
    .join("");
}


let latestOrders = [];

async function loadOrderProgress() {
  try {
    const res = await fetch("/api/delivery/for-buyer", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    latestOrders = Array.isArray(data) ? data : [];
    renderOrders(latestOrders);
    renderStats();
  } catch (err) {
    console.error("Could not load order progress", err);
  }
}

function renderOrders(orders) {
  const inProgress = orders.filter((o) => ["accepted", "in_transit"].includes(o.status));
  document.getElementById("statProgress").textContent = inProgress.length;
  document.getElementById("statProgressSub").textContent = inProgress.length ? "In transit or picked up" : "Nothing moving right now";

  const list = document.getElementById("ordersList");
  if (orders.length === 0) {
    list.innerHTML = `<div class="panel-empty">No deliveries linked to your paid orders yet.<br>Your farmer needs to request transport for a paid reservation before it shows up here.</div>`;
    document.getElementById("ordersFoot").textContent = "";
    return;
  }
  list.innerHTML = orders
    .slice(0, 8)
    .map(
      (o) => `
    <div class="row-item">
      <div class="row-thumb">🚚</div>
      <div>
        <div class="ri-title">${escapeHtml(o.crop_name)} — Order #${o.request_id}</div>
        <div class="ri-meta">${escapeHtml(o.pickup_district || "?")} → ${escapeHtml(o.dropoff_district || "?")}${o.transporter_name ? ` · ${escapeHtml(o.transporter_name)}` : ""}</div>
      </div>
      <div class="ri-right"><span class="status-chip ${o.status}">${(o.status || "").replace("_", " ")}</span></div>
    </div>`
    )
    .join("");
  document.getElementById("ordersFoot").textContent = `${orders.length} order${orders.length === 1 ? "" : "s"} tracked`;
}


function renderStats() {
  const now = new Date();
  const completedThisMonth = latestReservations.filter((r) => {
    if (r.status !== "paid") return false;
    const d = new Date(r.updated_at || r.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  document.getElementById("statCompleted").textContent = completedThisMonth.length;
  document.getElementById("statCompletedSub").textContent = "This month";
}


async function loadNotifications() {
  try {
    const res = await fetch("/api/notifications", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    const notifications = data.notifications || [];
    const unread = notifications.filter((n) => !n.is_read).length;
    [document.getElementById("notifBadge"), document.getElementById("bellIconBadge")].forEach((b) => {
      if (unread > 0) { b.textContent = unread; b.style.display = "inline-flex"; } else { b.style.display = "none"; }
    });
    const list = document.getElementById("notifList");
    list.innerHTML = notifications.length
      ? notifications.slice(0, 8).map((n) => `
      <div class="notif-item">
        <div class="notif-ic">🔔</div>
        <div class="notif-text">${escapeHtml(n.content)}<div class="notif-time">${timeAgo(n.created_at)}</div></div>
      </div>`).join("")
      : `<div class="panel-empty">No notifications yet.</div>`;
  } catch (err) {
    console.error("Could not load notifications", err);
  }
}

async function loadMessages() {
  try {
    const res = await fetch("/api/messages/conversations", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    const conversations = data.conversations || [];
    const unread = conversations.filter((c) => !c.is_read && c.receiver_id === user.user_id).length;
    [document.getElementById("msgBadge"), document.getElementById("mailIconBadge")].forEach((b) => {
      if (unread > 0) { b.textContent = unread; b.style.display = "inline-flex"; } else { b.style.display = "none"; }
    });
    const list = document.getElementById("msgList");
    list.innerHTML = conversations.length
      ? conversations.slice(0, 8).map((c) => `
      <div class="msg-item">
        <div class="msg-avatar">${escapeHtml((c.other_user_name || "?").charAt(0).toUpperCase())}</div>
        <div class="msg-text"><div class="m-name">${escapeHtml(c.other_user_name)}</div><div class="m-preview">${escapeHtml(c.body)}</div></div>
        ${!c.is_read && c.receiver_id === user.user_id ? '<div class="unread-dot"></div>' : ""}
      </div>`).join("")
      : `<div class="panel-empty">No messages yet.</div>`;
  } catch (err) {
    console.error("Could not load messages", err);
  }
}


let latestMarketplace = [];

async function loadMarketplace(cropFilter = "") {
  try {
    const params = new URLSearchParams();
    if (cropFilter) params.set("crop", cropFilter);
    const res = await fetch(`/api/produce${params.toString() ? "?" + params.toString() : ""}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    latestMarketplace = data.listings || [];
    renderMarketplace(latestMarketplace);
  } catch (err) {
    console.error("Could not load marketplace", err);
  }
}

function renderMarketplace(listings) {
  const grid = document.getElementById("marketplaceGrid");
  if (listings.length === 0) {
    grid.innerHTML = "";
    document.getElementById("marketplaceFoot").textContent = "No produce matches right now.";
    return;
  }
  grid.innerHTML = listings
    .map(
      (l) => `
    <div class="listing-card">
      ${l.image_url ? `<img src="${l.image_url}" alt="${escapeHtml(l.crop_name)}">` : `<div style="height:100px; background:#eee;"></div>`}
      <div class="body">
        <div class="crop">${escapeHtml(l.crop_name)}</div>
        <div class="meta">${l.available_quantity ?? l.quantity} ${escapeHtml(l.unit)} available</div>
        <div class="meta">${l.price_per_unit ? formatMoney(l.price_per_unit) + "/unit" : "Price on request"} · ${escapeHtml(l.district || "")}</div>
        <button class="mini-btn primary" style="width:100%; margin-top:6px;" onclick="openReserveModal(${l.listing_id}, '${escapeHtml(l.crop_name)}', ${Number(l.available_quantity ?? l.quantity)}, '${escapeHtml(l.unit)}')" ${Number(l.available_quantity ?? 0) <= 0 ? "disabled" : ""}>
          ${Number(l.available_quantity ?? 0) <= 0 ? "Fully reserved" : "Reserve"}
        </button>
      </div>
    </div>`
    )
    .join("");
  document.getElementById("marketplaceFoot").textContent = `${listings.length} listing${listings.length === 1 ? "" : "s"} available`;
}

let searchDebounce;
document.getElementById("marketSearch").addEventListener("input", (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadMarketplace(e.target.value.trim()), 350);
});

let reserveTarget = null;
function openReserveModal(listing_id, crop_name, available, unit) {
  reserveTarget = { listing_id, available };
  document.getElementById("reserveModalTitle").textContent = `Reserve ${crop_name} (${available} ${unit} available)`;
  document.getElementById("reserveQty").value = "";
  document.getElementById("reserveQty").max = available;
  document.getElementById("reserveMsg").classList.remove("show");
  document.getElementById("reserveModalOverlay").classList.add("show");
}
document.getElementById("cancelReserveBtn").addEventListener("click", () => {
  document.getElementById("reserveModalOverlay").classList.remove("show");
});
document.getElementById("confirmReserveBtn").addEventListener("click", async () => {
  const msg = document.getElementById("reserveMsg");
  const qty = Number(document.getElementById("reserveQty").value);
  if (!qty || qty <= 0) {
    msg.textContent = "Enter a valid quantity.";
    msg.className = "inline-msg show err";
    return;
  }
  try {
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ listing_id: reserveTarget.listing_id, quantity: qty }),
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || "Could not reserve.";
      msg.className = "inline-msg show err";
      return;
    }
    showToast("Reservation requested — waiting on farmer approval.");
    document.getElementById("reserveModalOverlay").classList.remove("show");
    loadReservations();
    loadMarketplace();
  } catch (err) {
    console.error(err);
  }
});


let payTarget = null;
let selectedMethod = null;
function openPayModal(reservation_id, crop_name, pricePerUnit, quantity) {
  payTarget = reservation_id;
  selectedMethod = null;
  document.querySelectorAll(".method-btn").forEach((b) => b.classList.remove("selected"));
  const amount = pricePerUnit * quantity;
  document.getElementById("payAmountLine").textContent = `${crop_name} · ${quantity} units · Total: ${formatMoney(amount)}`;
  document.getElementById("payMsg").classList.remove("show");
  document.getElementById("payModalOverlay").classList.add("show");
}
document.querySelectorAll(".method-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".method-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedMethod = btn.getAttribute("data-method");
  });
});
document.getElementById("cancelPayBtn").addEventListener("click", () => {
  document.getElementById("payModalOverlay").classList.remove("show");
});
document.getElementById("confirmPayBtn").addEventListener("click", async () => {
  const msg = document.getElementById("payMsg");
  if (!selectedMethod) {
    msg.textContent = "Select a payment method.";
    msg.className = "inline-msg show err";
    return;
  }
  try {
    const res = await fetch("/api/payments/produce", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ reservation_id: payTarget, method: selectedMethod }),
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || "Payment failed.";
      msg.className = "inline-msg show err";
      return;
    }
    showToast(`Payment complete — ref ${data.transaction_ref}`);
    document.getElementById("payModalOverlay").classList.remove("show");
    loadReservations();
    loadOrderProgress();
  } catch (err) {
    console.error(err);
  }
});


loadReservations();
loadOrderProgress();
loadNotifications();
loadMessages();
loadMarketplace();