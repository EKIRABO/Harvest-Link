
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

function showToast(msg, ms = 3200) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("show"), ms);
}


const ROLE_CONFIG = {
  farmer: {
    theme: "farmer",
    badgeLabel: "",
    items: [
      { label: "Dashboard", ic: "▦", href: "dashboard-farmer.html" },
      { label: "Inventory", ic: "📦", href: "dashboard-farmer.html" },
      { label: "Listings", ic: "🧾", href:"listings.html" },
      { label: "Reservations", ic: "📋", href: "dashboard-farmer.html" },
      { label: "Offline Sales", ic: "💵", href:"offline-sales.html" },
      { label: "Transport Requests", ic: "🚚", href: "dashboard-farmer.html" },
      { label: "Storage Bookings", ic: "🏬", href: "dashboard-farmer.html" },
      { divider: true },
      { label: "Messages", ic: "💬", href: "messages.html" },
      { label: "Notifications", ic: "🔔", href: "notifications-admin.html", active: true },
      { label: "Sales Analytics", ic: "📈", href:"sales-analytics.html"},
    ],
  },
  buyer: {
    theme: "farmer",
    items: [
      { label: "Dashboard", ic: "▦", href: "dashboard-buyer.html" },
      { label: "Marketplace", ic: "🛒", href: "dashboard-buyer.html" },
      { label: "My Reservations", ic: "📋", href: "dashboard-buyer.html" },
      { label: "Order Progress", ic: "📦", href: "dashboard-buyer.html" },
      { label: "Order History", ic: "🧾", href: "dashboard-buyer.html" },
      { label: "Favorites", ic: "❤️", disabled: true },
      { divider: true },
      { label: "Messages", ic: "💬", href: "messages.html" },
      { label: "Notifications", ic: "🔔", href: "notifications-admin.html", active: true },
   
    ],
  },
  transporter: {
    theme: "farmer",
    items: [
      { label: "Dashboard", ic: "▦", href: "dashboard-transporter.html" },
      { label: "Vehicle & Capacity", ic: "🚚", href: "dashboard-transporter.html" },
      { label: "Available Requests", ic: "📋", href: "dashboard-transporter.html" },
      { label: "Active Deliveries", ic: "📦", href: "dashboard-transporter.html" },
      { label: "Delivery History", ic: "🧾", href: "dashboard-transporter.html" },
      { label: "Earnings", ic: "💵", href: "dashboard-transporter.html" },
      { divider: true },
      { label: "Messages", ic: "💬", href: "messages.html" },
      { label: "Notifications", ic: "🔔", href: "notifications-admin.html", active: true },
    ],
  },
  storage_provider: {
    theme: "farmer",
    items: [
      { label: "Dashboard", ic: "▦", href: "dashboard-storager.html" },
      { label: "Capacity Overview", ic: "📊", href: "dashboard-storager.html" },
      { label: "Storage Bookings", ic: "📦", href: "dashboard-storager.html" },
      { label: "Pending Requests", ic: "⏱", href: "dashboard-storager.html" },
      { label: "Storage Types", ic: "🏷", href: "dashboard-storager.html" },
      { label: "Earnings", ic: "$", href: "dashboard-storager.html" },
      { divider: true },
      { label: "Messages", ic: "💬", href: "messages.html" },
      { label: "Notifications", ic: "🔔", href: "notifications-admin.html", active: true },
    
    ],
  },
  admin: {
    theme: "admin",
    items: [
      { label: "Dashboard", ic: "▦", href: "dashboard-admin.html" },
      { label: "User Management", ic: "👥", href: "dashboard-admin.html" },
      { label: "Listings", ic: "🧾", href: "listings-oversight.html" },
      { label: "Reports & Analytics", ic: "💹", href: "reports-analytics.html" },
      { label: "Activity Log", ic: "🕓", href: "dashboard-admin.html" },
      { divider: true },
      { label: "Notifications", ic: "🔔", href: "notifications-admin.html", active: true },
    ],
  },
};

function renderSidebar() {
  const config = ROLE_CONFIG[user.role] || ROLE_CONFIG.farmer;
  if (config.theme === "admin") {
    document.documentElement.classList.add("theme-admin");
  }

  const badgeLabel = user.role === "admin" ? "Super Administrator" : user.role.replace("_", " ");

  const itemsHtml = config.items
    .map((item) => {
      if (item.divider) return `<div class="nav-divider"></div>`;
      if (item.disabled) {
        return `<a class="nav-link disabled" data-soon="${item.label}"><span class="ic">${item.ic}</span><span class="label">${item.label}</span><span class="soon-tag">Soon</span></a>`;
      }
      return `<a class="nav-link${item.active ? " active" : ""}" href="${item.href}"><span class="ic">${item.ic}</span><span class="label">${item.label}</span></a>`;
    })
    .join("");

  document.getElementById("sidebarRoot").innerHTML = `
    <div class="brand-row">
      <div class="brand-icon">🌿</div>
      <div class="name">HarvestLink</div>
    </div>
    <div class="id-chip">
      <div class="id-avatar" id="idAvatar">?</div>
      <div>
        <div class="id-name" id="idName">—</div>
        <div class="id-badge">${escapeHtml(badgeLabel)}</div>
      </div>
    </div>
    <nav class="side-nav">
      ${itemsHtml}
      <a class="nav-link" id="logoutBtn"><span class="ic">⎋</span><span class="label">Logout</span></a>
    </nav>
  `;

  document.getElementById("idName").textContent = user.full_name;
  document.getElementById("idAvatar").textContent = user.full_name.charAt(0).toUpperCase();

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
}
renderSidebar();


document.addEventListener("DOMContentLoaded", async () => {
  const listContainer = document.getElementById("notifications-list");

  try {
    const response = await fetch("/api/notifications", { headers: authHeaders() });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    const notifications = data.notifications;

    if (!notifications || notifications.length === 0) {
      listContainer.innerHTML = `<p class="panel-empty">You have no notifications right now.</p>`;
      return;
    }

    listContainer.innerHTML = notifications
      .map(
        (n) => `
      <div class="notif-item ${!n.is_read ? "unread" : ""}">
        <div class="notif-ic">🔔</div>
        <div>
          <div class="notif-text">${escapeHtml(n.content)}</div>
          <div class="notif-time">${new Date(n.created_at).toLocaleString()}</div>
        </div>
      </div>`
      )
      .join("");

  } catch (err) {
    console.error(err);
    if (listContainer) {
      listContainer.innerHTML = `<p class="panel-empty error-state">Could not load notifications.</p>`;
    }
  }
});