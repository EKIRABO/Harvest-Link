const token = localStorage.getItem("hl_token");
const user = JSON.parse(localStorage.getItem("hl_user") || "null");
if (!token || !user || user.role !== "farmer") window.location.href = "login.html";

function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }; }
function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }
function money(n) { return `RWF ${Number(n || 0).toLocaleString()}`; }

async function load() {
  const [onlineRes, offlineRes] = await Promise.all([
    fetch("/api/payments/farmer-sales", { headers: authHeaders() }),
    fetch("/api/offline-sales/mine", { headers: authHeaders() }),
  ]);
  const onlineData = await onlineRes.json();
  const offlineData = await offlineRes.json();

  const online = (onlineData.sales || []).map((s) => ({
    crop_name: s.crop_name, quantity: s.quantity, unit: s.unit,
    amount: s.amount, created_at: s.created_at, source: "online",
  }));

 
  const now = new Date();
  const offlineThisMonth = (offlineData.sales || []).filter((s) => {
    const d = new Date(s.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).map((s) => ({
    crop_name: s.crop_name, quantity: s.quantity, unit: s.unit,
    amount: s.amount, created_at: s.created_at, source: "offline",
  }));

  const onlineTotal = online.reduce((s, r) => s + Number(r.amount), 0);
  const offlineTotal = offlineThisMonth.reduce((s, r) => s + Number(r.amount), 0);

  document.getElementById("onlineTotal").textContent = money(onlineTotal);
  document.getElementById("offlineTotal").textContent = money(offlineTotal);
  document.getElementById("combinedTotal").textContent = money(onlineTotal + offlineTotal);

  const combined = [...online, ...offlineThisMonth].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  renderCropBars(combined);
  renderTable(combined);
}

function renderCropBars(rows) {
  const byCrop = {};
  rows.forEach((r) => { byCrop[r.crop_name] = (byCrop[r.crop_name] || 0) + Number(r.amount); });
  const entries = Object.entries(byCrop).sort((a, b) => b[1] - a[1]);
  const max = entries.length ? entries[0][1] : 0;

  const wrap = document.getElementById("cropBars");
  const empty = document.getElementById("cropEmpty");
  if (entries.length === 0) { wrap.innerHTML = ""; empty.style.display = "block"; return; }
  empty.style.display = "none";
  wrap.innerHTML = entries.map(([crop, amt]) => `
    <div class="crop-bar-item">
      <div class="crop-bar-head"><span>${esc(crop)}</span><span>${money(amt)}</span></div>
      <div class="crop-bar-track"><div class="crop-bar-fill" style="width:${max > 0 ? (amt / max) * 100 : 0}%;"></div></div>
    </div>`).join("");
}

function renderTable(rows) {
  const tbody = document.getElementById("tbody");
  const empty = document.getElementById("listEmpty");
  if (rows.length === 0) { tbody.innerHTML = ""; empty.style.display = "block"; return; }
  empty.style.display = "none";
  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td>${esc(r.crop_name)}</td>
      <td>${r.quantity} ${esc(r.unit || "")}</td>
      <td>${money(r.amount)}</td>
      <td><span class="src-tag ${r.source}">${r.source}</span></td>
      <td>${new Date(r.created_at).toLocaleDateString()}</td>
    </tr>`).join("");
}

load();