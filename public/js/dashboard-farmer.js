
const token = localStorage.getItem("hl_token");
const user = JSON.parse(localStorage.getItem("hl_user") || "null");

if (!token || !user || user.role !== "farmer") {
  window.location.href = "login.html";
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}
function authHeadersNoContentType() {
  return { Authorization: `Bearer ${token}` };
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


document.getElementById("farmName").textContent = user.full_name;
document.getElementById("farmAvatar").textContent = user.full_name.charAt(0).toUpperCase();
document.getElementById("welcomeMsg").textContent = `Welcome back, ${user.full_name}! `;
document.getElementById("datePill").textContent = `📅 ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`;

if (user.is_verified) {
  document.getElementById("farmBadge").textContent = "✓ Verified Farmer";
} else if (user.is_verified === false) {
  document.getElementById("farmBadge").textContent = "Pending verification";
}

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

const DONUT_COLORS = ["#2f8a4c", "#3b6fd6", "#d65b5b", "#d98a2b", "#8a5cd6", "#d6b93b", "#4fb0a8", "#c25fa0"];
let latestListings = [];

async function loadInventory() {
  try {
    const res = await fetch("/api/produce/mine", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    latestListings = data.listings || [];
    renderInventory(latestListings);
    populateTransportListingSelect(latestListings);
    renderStats();
  } catch (err) {
    console.error("Could not load inventory", err);
  }
}

function renderInventory(listings) {
  const activeListings = listings.filter((l) => l.status === "available");
  const totalAvailable = listings.reduce((sum, l) => sum + Number(l.available_quantity ?? l.quantity ?? 0), 0);
  const inStockCount = listings.filter((l) => Number(l.available_quantity ?? 0) > 0).length;

  document.getElementById("statInventory").textContent = `${totalAvailable.toLocaleString()} ${listings[0]?.unit || "kg"}`;
  const uniqueCrops = new Set(listings.map((l) => l.crop_name)).size;
  document.getElementById("statInventorySub").textContent = `Across ${uniqueCrops} product${uniqueCrops === 1 ? "" : "s"}`;

  document.getElementById("statListings").textContent = activeListings.length;
  document.getElementById("statListingsSub").textContent = `${inStockCount} in stock`;

  const byCrop = {};
  listings.forEach((l) => {
    const key = l.crop_name || "Other";
    byCrop[key] = (byCrop[key] || 0) + Number(l.available_quantity ?? 0);
  });
  const entries = Object.entries(byCrop).filter(([, qty]) => qty > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, q]) => s + q, 0);

  document.getElementById("donutTotal").textContent = total > 0 ? `${total.toLocaleString()} ${listings[0]?.unit || "kg"}` : "0";

  const donutEl = document.getElementById("donutEl");
  if (total === 0) {
    donutEl.style.background = "#eee";
  } else {
    let acc = 0;
    const stops = entries.map(([crop, qty], i) => {
      const start = (acc / total) * 100;
      acc += qty;
      const end = (acc / total) * 100;
      return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${end}%`;
    });
    donutEl.style.background = `conic-gradient(${stops.join(", ")})`;
  }

  const legend = document.getElementById("donutLegend");
  legend.innerHTML = entries.length
    ? entries
        .map(([crop, qty], i) => `<div class="item"><span class="dot" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></span> ${escapeHtml(crop)} — ${qty.toLocaleString()} ${listings[0]?.unit || ""}</div>`)
        .join("")
    : "";

  document.getElementById("inventoryFoot").textContent = listings.length ? `${listings.length} listing${listings.length === 1 ? "" : "s"} total` : "No listings yet";
}


let latestReservations = [];

async function loadReservations() {
  try {
    const res = await fetch("/api/reservations/incoming", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    latestReservations = data.reservations || [];
    renderReservations(latestReservations);
    renderStats();
  } catch (err) {
    console.error("Could not load reservations", err);
  }
}

function renderReservations(reservations) {
  const pending = reservations.filter((r) => r.status === "pending");
  document.getElementById("statPending").textContent = pending.length;
  const pendingQty = pending.reduce((s, r) => s + Number(r.quantity), 0);
  document.getElementById("statPendingSub").textContent = pending.length ? `Total ${pendingQty.toLocaleString()} ${pending[0]?.unit || ""}` : "None right now";

  const list = document.getElementById("reservationsList");
  if (pending.length === 0) {
    list.innerHTML = `<div class="panel-empty">No pending reservations.</div>`;
  } else {
    list.innerHTML = pending
      .map(
        (r) => `
      <div class="row-item">
        <div class="row-thumb">📦</div>
        <div>
          <div class="ri-title">${escapeHtml(r.crop_name)}</div>
          <div class="ri-meta">${escapeHtml(r.buyer_name)} · ${r.quantity} ${escapeHtml(r.unit || "")} · ${timeAgo(r.created_at)}</div>
        </div>
        <div class="ri-right">
          <button class="mini-btn primary" onclick="approveReservation(${r.reservation_id})">Approve</button>
          <button class="mini-btn danger" onclick="openRejectModal(${r.reservation_id})">Reject</button>
        </div>
      </div>`
      )
      .join("");
  }
  document.getElementById("reservationsFoot").textContent = `${reservations.length} total reservation${reservations.length === 1 ? "" : "s"} (all statuses)`;
}

async function approveReservation(id) {
  try {
    const res = await fetch(`/api/reservations/${id}/approve`, { method: "PUT", headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Could not approve reservation.");
      return;
    }
    showToast("Reservation approved.");
    loadReservations();
  } catch (err) {
    console.error(err);
  }
}

let rejectTargetId = null;
function openRejectModal(id) {
  rejectTargetId = id;
  document.getElementById("rejectReason").value = "";
  document.getElementById("rejectMsg").classList.remove("show");
  document.getElementById("rejectModalOverlay").classList.add("show");
}
document.getElementById("cancelRejectBtn").addEventListener("click", () => {
  document.getElementById("rejectModalOverlay").classList.remove("show");
});
document.getElementById("confirmRejectBtn").addEventListener("click", async () => {
  const reason = document.getElementById("rejectReason").value.trim();
  const msg = document.getElementById("rejectMsg");
  if (!reason) {
    msg.textContent = "A reason is required.";
    msg.className = "inline-msg show err";
    return;
  }
  try {
    const res = await fetch(`/api/reservations/${rejectTargetId}/reject`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || "Could not reject reservation.";
      msg.className = "inline-msg show err";
      return;
    }
    document.getElementById("rejectModalOverlay").classList.remove("show");
    showToast("Reservation rejected.");
    loadReservations();
  } catch (err) {
    console.error(err);
  }
});

async function loadSales() {
  try {
    const res = await fetch("/api/payments/farmer-sales", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    renderSales(data.sales || [], Number(data.total_amount || 0));
  } catch (err) {
    console.error("Could not load sales", err);
  }
}

function renderSales(sales, totalAmount) {
  document.getElementById("statSales").textContent = formatMoney(totalAmount);
  document.getElementById("statSalesSub").textContent = sales.length ? `${sales.length} sale${sales.length === 1 ? "" : "s"} this month` : "No sales yet this month";

  const list = document.getElementById("salesList");
  if (sales.length === 0) {
    list.innerHTML = `<div class="panel-empty">No completed sales yet this month.</div>`;
  } else {
    list.innerHTML = sales
      .slice(0, 8)
      .map(
        (s) => `
      <div class="row-item">
        <div class="row-thumb">💰</div>
        <div>
          <div class="ri-title">${escapeHtml(s.crop_name)}</div>
          <div class="ri-meta">${new Date(s.created_at).toLocaleDateString()} · ${s.quantity} ${escapeHtml(s.unit || "")} · ${escapeHtml(s.buyer_name)}</div>
        </div>
        <div class="ri-right"><div class="amount">${formatMoney(s.amount)}</div></div>
      </div>`
      )
      .join("");
  }
  document.getElementById("salesFoot").textContent = `Total revenue this month: ${formatMoney(totalAmount)}`;
}

async function loadNotifications() {
  try {
    const res = await fetch("/api/notifications", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    const notifications = data.notifications || [];
    const unread = notifications.filter((n) => !n.is_read).length;

    [document.getElementById("notifBadge"), document.getElementById("bellIconBadge")].forEach((b) => {
      if (unread > 0) {
        b.textContent = unread;
        b.style.display = "inline-flex";
      } else {
        b.style.display = "none";
      }
    });

    const list = document.getElementById("notifList");
    list.innerHTML = notifications.length
      ? notifications
          .slice(0, 8)
          .map(
            (n) => `
      <div class="notif-item">
        <div class="notif-ic">🔔</div>
        <div class="notif-text">${escapeHtml(n.content)}<div class="notif-time">${timeAgo(n.created_at)}</div></div>
      </div>`
          )
          .join("")
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
      if (unread > 0) {
        b.textContent = unread;
        b.style.display = "inline-flex";
      } else {
        b.style.display = "none";
      }
    });

    const list = document.getElementById("msgList");
  list.innerHTML = conversations.length
  ? conversations
      .slice(0, 3)
      .map(
        (c) => `
      <a href="messages.html" class="msg-item" style="cursor:pointer;">
        <div class="msg-avatar">${escapeHtml((c.other_user_name || "?").charAt(0).toUpperCase())}</div>
        <div class="msg-text">
          <div class="m-name">${escapeHtml(c.other_user_name)}</div>
          <div class="m-preview">${escapeHtml(c.body)}</div>
        </div>
        ${!c.is_read && c.receiver_id === user.user_id ? '<div class="unread-dot"></div>' : ""}
      </a>`
      )
      .join("")
  : `<div class="panel-empty">No messages yet.</div>`;
  } catch (err) {
    console.error("Could not load messages", err);
  }
}
let activeThreadUserId = null;

async function openThread(otherUserId, otherName) {
  activeThreadUserId = otherUserId;
  const thread = document.getElementById("msgThread");
  const box = document.getElementById("msgThreadMessages");
  thread.style.display = "block";
  box.innerHTML = "Loading…";
  try {
    const res = await fetch(`/api/messages/${otherUserId}`, { headers: authHeaders() });
    const data = await res.json();
    const msgs = data.thread || [];
    box.innerHTML = msgs.length
      ? msgs.map((m) => `<div style="margin-bottom:6px; font-size:12px;"><strong>${m.sender_id === user.user_id ? "You" : escapeHtml(otherName)}:</strong> ${escapeHtml(m.body)}</div>`).join("")
      : `<div class="panel-empty">No messages with ${escapeHtml(otherName)} yet.</div>`;
    loadMessages(); 
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("msgReplySend").addEventListener("click", async () => {
  const input = document.getElementById("msgReplyInput");
  const body = input.value.trim();
  if (!body || !activeThreadUserId) return;
  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ receiver_id: activeThreadUserId, body }),
    });
    if (res.ok) {
      input.value = "";
      openThread(activeThreadUserId, document.querySelector(`.msg-item[onclick*="${activeThreadUserId}"] .m-name`)?.textContent || "them");
    }
  } catch (err) {
    console.error(err);
  }
});

async function loadStorageBookings() {
  try {
    const res = await fetch("/api/storage/bookings/mine", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    renderStorageBookings(data.bookings || []);
  } catch (err) {
    console.error("Could not load storage bookings", err);
  }
}

function renderStorageBookings(bookings) {
  const list = document.getElementById("storageList");
  if (bookings.length === 0) {
    list.innerHTML = `<div class="panel-empty">No storage bookings yet.</div>`;
    return;
  }
  list.innerHTML = bookings
    .slice(0, 6)
    .map(
      (b) => `
    <div class="row-item">
      <div class="b-ic">🏬</div>
      <div>
        <div class="ri-title">${escapeHtml(b.facility_name)}</div>
        <div class="ri-meta">${b.quantity_tons} tons · ${escapeHtml(b.facility_district || "")}</div>
      </div>
      <div class="ri-right">
        <span class="status-chip ${b.status}">${b.status}</span>
      </div>
    </div>`
    )
    .join("");
}

async function loadTransportRequests() {
  try {
    const res = await fetch("/api/delivery/mine", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    const rows = (Array.isArray(data) ? data : []).filter((d) => d.requested_by === user.user_id);
    renderTransportRequests(rows);
  } catch (err) {
    console.error("Could not load transport requests", err);
  }
}

function renderTransportRequests(rows) {
  const list = document.getElementById("transportList");
  if (rows.length === 0) {
    list.innerHTML = `<div class="panel-empty">No transport requests yet.</div>`;
    return;
  }
  list.innerHTML = rows
    .slice(0, 6)
    .map(
      (r) => `
    <div class="row-item">
      <div class="t-ic">🚚</div>
      <div>
        <div class="ri-title">${escapeHtml(r.crop_name)} — Request #${r.request_id}</div>
        <div class="ri-meta">${escapeHtml(r.pickup_district || "?")} → ${escapeHtml(r.dropoff_district || "?")}</div>
      </div>
      <div class="ri-right">
        <span class="status-chip ${r.status}">${(r.status || "").replace("_", " ")}</span>
      </div>
    </div>`
    )
    .join("");
}


function renderStats() {
  const pendingCount = latestReservations.filter((r) => r.status === "pending").length;
  const summary = document.getElementById("quickSummary");
  if (summary) {
    summary.innerHTML = pendingCount > 0
      ? `You have <strong style="color:var(--text)">${pendingCount} pending reservation${pendingCount === 1 ? "" : "s"}</strong> awaiting approval. Approving promptly keeps buyers from reserving elsewhere.`
      : `No pending reservations right now — you're all caught up.`;
  }
}


const listingModalOverlay = document.getElementById("listingModalOverlay");
document.getElementById("addListingBtn").addEventListener("click", () => listingModalOverlay.classList.add("show"));
document.getElementById("qaAddListing").addEventListener("click", () => listingModalOverlay.classList.add("show"));
document.getElementById("cancelListingBtn").addEventListener("click", () => listingModalOverlay.classList.remove("show"));
listingModalOverlay.addEventListener("click", (e) => {
  if (e.target === listingModalOverlay) listingModalOverlay.classList.remove("show");
});

document.getElementById("listingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData();
  formData.append("crop_name", document.getElementById("crop_name").value.trim());
  formData.append("quantity", document.getElementById("quantity").value);
  formData.append("unit", document.getElementById("unit").value);
  formData.append("price_per_unit", document.getElementById("price_per_unit").value || "");
  formData.append("district", document.getElementById("district").value.trim());
  formData.append("sector", document.getElementById("sector").value.trim());
  formData.append("harvest_date", document.getElementById("harvest_date").value || "");
  formData.append("description", document.getElementById("description").value.trim());
  const imageFile = document.getElementById("image").files[0];
  if (imageFile) formData.append("image", imageFile);

  const msg = document.getElementById("listingMsg");
  try {
    const res = await fetch("/api/produce", { method: "POST", headers: authHeadersNoContentType(), body: formData });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || "Could not post listing.";
      msg.className = "inline-msg show err";
      return;
    }
    msg.textContent = "Listing posted.";
    msg.className = "inline-msg show ok";
    document.getElementById("listingForm").reset();
    setTimeout(() => {
      msg.classList.remove("show");
      listingModalOverlay.classList.remove("show");
    }, 1000);
    loadInventory();
  } catch (err) {
    console.error(err);
  }
});

function populateTransportListingSelect(listings) {
  const sel = document.getElementById("rt_listing");
  sel.innerHTML = listings.length
    ? listings.map((l) => `<option value="${l.listing_id}">${escapeHtml(l.crop_name)} — ${l.quantity} ${escapeHtml(l.unit)}</option>`).join("")
    : `<option value="">No listings yet</option>`;
}
const transportModalOverlay = document.getElementById("transportModalOverlay");
document.getElementById("qaRequestTransport").addEventListener("click", () => {
  if (latestListings.length === 0) {
    showToast("Add a listing first — transport requests need a listing to attach to.");
    return;
  }
  document.getElementById("transportModalMsg").classList.remove("show");
  transportModalOverlay.classList.add("show");
});
document.getElementById("cancelTransportBtn").addEventListener("click", () => transportModalOverlay.classList.remove("show"));
document.getElementById("confirmTransportBtn").addEventListener("click", async () => {
  const msg = document.getElementById("transportModalMsg");
  const listing_id = document.getElementById("rt_listing").value;
  const pickup_district = document.getElementById("rt_pickup").value.trim();
  const dropoff_district = document.getElementById("rt_dropoff").value.trim();
  const pickup_date = document.getElementById("rt_date").value;
  const notes = document.getElementById("rt_notes").value.trim();

  if (!listing_id) {
    msg.textContent = "Select a listing.";
    msg.className = "inline-msg show err";
    return;
  }
  try {
    const res = await fetch("/api/delivery/request", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ listing_id, pickup_district, dropoff_district, pickup_date, notes }),
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || "Could not send request.";
      msg.className = "inline-msg show err";
      return;
    }
    showToast("Transport request sent.");
    transportModalOverlay.classList.remove("show");
    loadTransportRequests();
  } catch (err) {
    console.error(err);
  }
});

const storageModalOverlay = document.getElementById("storageModalOverlay");
document.getElementById("qaBookStorage").addEventListener("click", async () => {
  document.getElementById("storageModalMsg").classList.remove("show");
  const sel = document.getElementById("bs_facility");
  sel.innerHTML = `<option>Loading facilities…</option>`;
  storageModalOverlay.classList.add("show");
  try {
    const res = await fetch("/api/storage", { headers: authHeaders() });
    const data = await res.json();
    const facilities = data.facilities || [];
    sel.innerHTML = facilities.length
      ? facilities.map((f) => `<option value="${f.user_id}">${escapeHtml(f.facility_name)} — ${escapeHtml(f.district || "")} (${f.available_capacity_tons ?? "?"}t free)</option>`).join("")
      : `<option value="">No facilities available</option>`;
  } catch (err) {
    sel.innerHTML = `<option value="">Could not load facilities</option>`;
  }
});
document.getElementById("cancelStorageBtn").addEventListener("click", () => storageModalOverlay.classList.remove("show"));
document.getElementById("confirmStorageBtn").addEventListener("click", async () => {
  const msg = document.getElementById("storageModalMsg");
  const storage_user_id = document.getElementById("bs_facility").value;
  const quantity_tons = document.getElementById("bs_quantity").value;
  const notes = document.getElementById("bs_notes").value.trim();

  if (!storage_user_id || !quantity_tons) {
    msg.textContent = "Select a facility and enter a quantity.";
    msg.className = "inline-msg show err";
    return;
  }
  try {
    const res = await fetch("/api/storage/bookings", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ storage_user_id, quantity_tons, notes }),
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || "Could not request booking.";
      msg.className = "inline-msg show err";
      return;
    }
    showToast("Storage booking requested.");
    storageModalOverlay.classList.remove("show");
    loadStorageBookings();
  } catch (err) {
    console.error(err);
  }
});

document.getElementById("qaOfflineSale").addEventListener("click", () => {
  showToast("Offline sales isn't built yet — needs a new table to record manual sales and decrement inventory. Ask me to build it if you want it next.");
});
document.getElementById("qaViewReservations").addEventListener("click", () => {
  document.getElementById("reservationsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.getElementById("qaViewSales").addEventListener("click", () => {
  document.getElementById("salesPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});


document.getElementById("bellIconBtn").addEventListener("click", () => {
  document.getElementById("notifPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.getElementById("mailIconBtn").addEventListener("click", () => {
  document.getElementById("messagesPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

loadInventory();
loadReservations();
loadSales();
loadNotifications();
loadMessages();
loadStorageBookings();
loadTransportRequests();