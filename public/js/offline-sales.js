const token = localStorage.getItem("hl_token");
const user = JSON.parse(localStorage.getItem("hl_user") || "null");
if (!token || !user || user.role !== "farmer") window.location.href = "login.html";

function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }; }
function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }

async function loadListingOptions() {
  const res = await fetch("/api/produce/mine", { headers: authHeaders() });
  const data = await res.json();
  const sel = document.getElementById("listing_id");
  const available = (data.listings || []).filter((l) => l.status === "available");
  sel.innerHTML = available.length
    ? available.map((l) => `<option value="${l.listing_id}">${esc(l.crop_name)} — ${l.available_quantity ?? l.quantity} ${esc(l.unit)} available</option>`).join("")
    : `<option value="">No available listings</option>`;
}

async function loadSales() {
  const res = await fetch("/api/offline-sales/mine", { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) return;
  const sales = data.sales || [];
  const tbody = document.getElementById("tbody");
  const empty = document.getElementById("empty");
  if (sales.length === 0) {
    tbody.innerHTML = ""; empty.style.display = "block";
    document.getElementById("totalLine").textContent = "";
    return;
  }
  empty.style.display = "none";
  tbody.innerHTML = sales.map((s) => `
    <tr>
      <td>${esc(s.crop_name)}</td>
      <td>${s.quantity} ${esc(s.unit)}</td>
      <td>RWF ${Number(s.amount).toLocaleString()}</td>
      <td>${esc(s.buyer_name || "—")}</td>
      <td>${new Date(s.created_at).toLocaleDateString()}</td>
    </tr>`).join("");
  const total = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  document.getElementById("totalLine").textContent = `Total recorded: RWF ${total.toLocaleString()} across ${sales.length} sale${sales.length === 1 ? "" : "s"}`;
}

document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("msg");
  const payload = {
    listing_id: document.getElementById("listing_id").value,
    quantity: document.getElementById("quantity").value,
    amount: document.getElementById("amount").value,
    buyer_name: document.getElementById("buyer_name").value.trim(),
    notes: document.getElementById("notes").value.trim(),
  };
  if (!payload.listing_id) {
    msg.textContent = "Select a listing."; msg.className = "inline-msg show err"; return;
  }
  const res = await fetch("/api/offline-sales", { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) {
    msg.textContent = data.error || "Could not record sale."; msg.className = "inline-msg show err"; return;
  }
  msg.textContent = "Sale recorded."; msg.className = "inline-msg show ok";
  document.getElementById("form").reset();
  loadListingOptions();
  loadSales();
});

loadListingOptions();
loadSales();