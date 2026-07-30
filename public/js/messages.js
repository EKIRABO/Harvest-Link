
const token = localStorage.getItem("hl_token");
const user = JSON.parse(localStorage.getItem("hl_user") || "null");

if (!token || !user) {
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
function showToast(msg, ms = 3200) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("show"), ms);
}

const ROLE_CONFIG = {
  farmer: {
    roleLabel: "Farmer",
    colors: { sidebarBg: "#16351f", sidebarBg2: "#0f2417", brand: "#2f8a4c" },
    nav: [
      { label: "Dashboard", icon: "▦", href: "dashboard-farmer.html" },
      { label: "Inventory", icon: "📦", href: "dashboard-farmer.html" },
      { label: "Listings", icon: "🧾", href:"listings.html" },
      { label: "Reservations", icon: "📋", href: "dashboard-farmer.html" },
      { label: "Offline Sales", icon: "💵", href:"offline-sales.html" },
      { label: "Transport Requests", icon: "🚚", href: "dashboard-farmer.html" },
      { label: "Storage Bookings", icon: "🏬", href: "dashboard-farmer.html" },
      { divider: true },
      { label: "Messages", icon: "💬", href: "messages.html", active: true, badgeId: "msgBadge" },
      { label: "Notifications", icon: "🔔", href: "notifications-admin.html", badgeId: "notifBadge" },
      { label: "Sales Analytics", icon: "📈", href:"sales-analytics.html"},

      { divider: true },
      { label: "Logout", icon: "⎋", logout: true },
    ],
  },
  buyer: {
    roleLabel: "Buyer",
    colors: { sidebarBg: "#16351f", sidebarBg2: "#0f2417", brand: "#2f8a4c" },
    nav: [
      { label: "Dashboard", icon: "▦", href: "dashboard-buyer.html" },
      { label: "Marketplace", icon: "🛒", href: "dashboard-buyer.html" },
      { label: "My Reservations", icon: "📋", href: "dashboard-buyer.html" },
      { label: "Order Progress", icon: "🚚", href: "dashboard-buyer.html" },
      { label: "Order History", icon: "🧾", href: "dashboard-buyer.html" },
      { divider: true },
      { label: "Messages", icon: "💬", href: "messages.html", active: true, badgeId: "msgBadge" },
      { label: "Notifications", icon: "🔔", href: "dashboard-buyer.html", badgeId: "notifBadge" },
      { divider: true },
      { label: "Logout", icon: "⎋", logout: true },
    ],
  },
  transporter: {
    roleLabel: "Transporter",
    colors: { sidebarBg: "#1e1633", sidebarBg2: "#150f24", brand: "#6D4AFF" },
    nav: [
      { label: "Dashboard", icon: "▦", href: "dashboard-transporter.html" },
      { label: "Vehicle & Capacity", icon: "🚚", href: "dashboard-transporter.html" },
      { label: "Available Requests", icon: "📋", href: "dashboard-transporter.html" },
      { label: "Active Deliveries", icon: "📦", href: "dashboard-transporter.html" },
      { label: "Delivery History", icon: "🧾", href: "dashboard-transporter.html" },
      { label: "Earnings", icon: "$", href: "dashboard-transporter.html" },
      { divider: true },
      { label: "Messages", icon: "💬", href: "messages.html", active: true, badgeId: "msgBadge" },
      { label: "Notifications", icon: "🔔", href: "notifications-admin.html", badgeId: "notifBadge" },
      { divider: true },
      { label: "Logout", icon: "⎋", logout: true },
    ],
  },
  storage_provider: {
    roleLabel: "Storage provider",
    colors: { sidebarBg: "#16351f", sidebarBg2: "#0f2417", brand: "#2f8a4c" },
    nav: [
      { label: "Dashboard", icon: "▦", href: "dashboard-storager.html" },
      { label: "Capacity Overview", icon: "📊", href: "dashboard-storager.html" },
      { label: "Storage Bookings", icon: "📦", href: "dashboard-storager.html" },
      { label: "Pending Requests", icon: "⏱", href: "dashboard-storager.html" },
      { label: "Storage Types", icon: "🏷", href: "dashboard-storager.html" },
      { label: "Earnings", icon: "$", href: "dashboard-storager.html" },
      { divider: true },
      { label: "Messages", icon: "💬", href: "messages.html", active: true, badgeId: "msgBadge" },
      { label: "Notifications", icon: "🔔", href: "dashboard-storager.html", badgeId: "notifBadge" },
      { divider: true },
      { label: "Logout", icon: "⎋", logout: true },
    ],
  },
  admin: {
    roleLabel: "Super Administrator",
    colors: { sidebarBg: "#0f1a3d", sidebarBg2: "#0a1329", brand: "#3b6fd6" },
    nav: [
      { label: "Dashboard", icon: "▦", href: "dashboard-admin.html" },
      { label: "User Management", icon: "👥", href: "dashboard-admin.html" },
      { label: "Activity Log", icon: "🕓", href: "dashboard-admin.html" },
      { divider: true },
     
      { label: "Logout", icon: "⎋", logout: true },
    ],
  },
};

function renderSidebar() {
  const config = ROLE_CONFIG[user.role];
  if (!config) {
    console.warn(`No sidebar config for role "${user.role}" — falling back to a bare Logout link.`);
  }

  if (config) {
    document.documentElement.style.setProperty("--sidebar-bg", config.colors.sidebarBg);
    document.documentElement.style.setProperty("--sidebar-bg-2", config.colors.sidebarBg2);
    document.documentElement.style.setProperty("--brand", config.colors.brand);
  }

  document.getElementById("userName").textContent = user.full_name;
  document.getElementById("userAvatar").textContent = (user.full_name || "?").charAt(0).toUpperCase();
  document.getElementById("userRole").textContent = config ? config.roleLabel : user.role;

  const navItems = config ? config.nav : [{ label: "Logout", icon: "⎋", logout: true }];
  const nav = document.getElementById("sideNav");
  nav.innerHTML = navItems
    .map((item) => {
      if (item.divider) return `<div class="nav-divider"></div>`;
      const activeClass = item.active ? " active" : "";
      const idAttr = item.logout ? ' id="logoutBtn"' : "";
      const badge = item.badgeId ? `<span class="badge" id="${item.badgeId}" style="display:none;">0</span>` : "";
      const hrefAttr = item.logout ? "" : ` href="${item.href}"`;
      return `<a class="nav-link${activeClass}"${idAttr}${hrefAttr}><span class="ic">${item.icon}</span><span class="label">${escapeHtml(item.label)}</span>${badge}</a>`;
    })
    .join("");

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("hl_token");
      localStorage.removeItem("hl_user");
      window.location.href = "login.html";
    });
  }
}

renderSidebar();


let activeUserId = null;
let conversationsCache = [];

async function loadConversations() {
  try {
    const res = await fetch("/api/messages/conversations", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    conversationsCache = data.conversations || [];
    renderConversations();

    const msgBadge = document.getElementById("msgBadge");
    if (msgBadge) {
      const unread = conversationsCache.filter((c) => !c.is_read && c.receiver_id === user.user_id).length;
      if (unread > 0) { msgBadge.textContent = unread; msgBadge.style.display = "inline-flex"; }
      else { msgBadge.style.display = "none"; }
    }
  } catch (err) {
    console.error("Could not load conversations", err);
  }
}

function renderConversations() {
  const list = document.getElementById("convList");
  if (conversationsCache.length === 0) {
    list.innerHTML = `<div class="panel-empty">No conversations yet.</div>`;
    return;
  }
  list.innerHTML = conversationsCache
    .map(
      (c) => `
    <div class="conv-item ${c.other_user_id === activeUserId ? "active" : ""}" onclick="selectConversation(${c.other_user_id}, '${escapeHtml(c.other_user_name)}')">
      <div class="conv-avatar">${escapeHtml((c.other_user_name || "?").charAt(0).toUpperCase())}</div>
      <div>
        <div class="conv-name">${escapeHtml(c.other_user_name)}</div>
        <div class="conv-preview">${escapeHtml(c.body)}</div>
      </div>
      ${!c.is_read && c.receiver_id === user.user_id ? '<div class="conv-unread"></div>' : ""}
    </div>`
    )
    .join("");
}

async function selectConversation(otherUserId, otherName) {
  activeUserId = otherUserId;
  renderConversations();
  document.getElementById("threadHeader").textContent = otherName;
  document.getElementById("replyRow").style.display = "flex";
  const body = document.getElementById("threadBody");
  body.innerHTML = `<div class="panel-empty">Loading…</div>`;

  try {
    const res = await fetch(`/api/messages/${otherUserId}`, { headers: authHeaders() });
    const data = await res.json();
    const msgs = data.thread || [];
    body.innerHTML = msgs.length
      ? msgs
          .map(
            (m) => `
        <div class="bubble ${m.sender_id === user.user_id ? "mine" : "theirs"}">
          ${escapeHtml(m.body)}
          <span class="bt">${timeAgo(m.created_at)}</span>
        </div>`
          )
          .join("")
      : `<div class="panel-empty">No messages with ${escapeHtml(otherName)} yet.</div>`;
    body.scrollTop = body.scrollHeight;
    loadConversations(); 
  } catch (err) {
    console.error("Could not load thread", err);
  }
}

document.getElementById("replySend").addEventListener("click", sendReply);
document.getElementById("replyInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendReply();
});

async function sendReply() {
  const input = document.getElementById("replyInput");
  const body = input.value.trim();
  if (!body || !activeUserId) return;
  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ receiver_id: activeUserId, body }),
    });
    if (res.ok) {
      input.value = "";
      const otherName = document.getElementById("threadHeader").textContent;
      selectConversation(activeUserId, otherName);
    }
  } catch (err) {
    console.error(err);
  }
}

loadConversations();