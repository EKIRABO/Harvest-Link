const token = localStorage.getItem("hl_token");
const user = JSON.parse(localStorage.getItem("hl_user") || "null");
if (!token || !user || user.role !== "admin") window.location.href = "login.html";

function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }; }
function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }

async function load(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.crop) params.set("crop", filters.crop);
  if (filters.district) params.set("district", filters.district);
  const qs = params.toString();

  const res = await fetch(`/api/analytics/all-listings${qs ? `?${qs}` : ""}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) return;
  render(data.listings || []);
}

function render(listings) {
  document.getElementById("countLabel").textContent = `${listings.length} listing${listings.length === 1 ? "" : "s"}`;
  const tbody = document.getElementById("tbody");
  const empty = document.getElementById("empty");
  if (listings.length === 0) { tbody.innerHTML = ""; empty.style.display = "block"; return; }
  empty.style.display = "none";
  tbody.innerHTML = listings.map((l) => `
    <tr>
      <td>${esc(l.crop_name)}</td>
      <td>${esc(l.farmer_name)}</td>
      <td>${l.available_quantity ?? l.quantity} ${esc(l.unit)}</td>
      <td>${l.price_per_unit ? `RWF ${l.price_per_unit}` : "—"}</td>
      <td>${esc(l.district || "—")}</td>
      <td><span class="status-chip ${l.status}">${l.status}</span></td>
      <td>${new Date(l.created_at).toLocaleDateString()}</td>
    </tr>`).join("");
}

document.getElementById("filterBtn").addEventListener("click", () => {
  load({
    status: document.getElementById("statusFilter").value,
    crop: document.getElementById("cropFilter").value.trim(),
    district: document.getElementById("districtFilter").value.trim(),
  });
});
document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("statusFilter").value = "";
  document.getElementById("cropFilter").value = "";
  document.getElementById("districtFilter").value = "";
  load();
});

load();