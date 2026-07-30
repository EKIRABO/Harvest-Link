const token = localStorage.getItem("hl_token");
const user = JSON.parse(localStorage.getItem("hl_user") || "null");
if (!token || !user || user.role !== "admin") window.location.href = "login.html";

function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }; }
function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }

async function loadOverview() {
  const res = await fetch("/api/analytics/overview", { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) return;
  const grid = document.getElementById("overviewGrid");
  const boxes = [
    { num: data.users?.farmers ?? 0, lbl: "Farmers" },
    { num: data.users?.buyers ?? 0, lbl: "Buyers" },
    { num: data.listings?.total_listings ?? 0, lbl: "Total listings" },
    { num: data.deliveries?.delivered ?? 0, lbl: "Deliveries completed" },
  ];
  grid.innerHTML = boxes.map((b) => `<div class="stat"><div class="num">${b.num}</div><div class="lbl">${b.lbl}</div></div>`).join("");
}

async function loadPerformance() {
  const res = await fetch("/api/analytics/delivery-performance", { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) return;
  const list = document.getElementById("perfList");
  const rows = [
    { lbl: "Avg. hours to accept", val: data.avg_hours_to_accept },
    { lbl: "Avg. hours to pickup", val: data.avg_hours_to_pickup },
    { lbl: "Avg. hours in transit", val: data.avg_hours_in_transit },
    { lbl: "Avg. total delivery time", val: data.avg_hours_total },
  ];
  list.innerHTML = rows.map((r) => `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
      <span>${r.lbl}</span><strong>${r.val != null ? Number(r.val).toFixed(1) + " hrs" : "No data yet"}</strong>
    </div>`).join("");
}

async function loadSupplyDemand() {
  const res = await fetch("/api/analytics/supply-demand", { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) return;
  const tbody = document.getElementById("supplyDemandBody");
  const empty = document.getElementById("sdEmpty");
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) { tbody.innerHTML = ""; empty.style.display = "block"; return; }
  empty.style.display = "none";
  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td>${esc(r.crop_name)}</td>
      <td>${r.total_supply}</td>
      <td>${r.total_demand}</td>
      <td>${r.gap > 0 ? `Shortage ${r.gap}` : r.gap < 0 ? `Surplus ${Math.abs(r.gap)}` : "Balanced"}</td>
    </tr>`).join("");
}

document.getElementById("exportBtn").addEventListener("click", () => {
  fetch("/api/analytics/export/listings.csv", { headers: authHeaders() })
    .then((res) => res.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "listings_report.csv"; a.click();
      window.URL.revokeObjectURL(url);
    });
});

loadOverview();
loadPerformance();
loadSupplyDemand();