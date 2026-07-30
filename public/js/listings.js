const token = localStorage.getItem("hl_token");
const user = JSON.parse(localStorage.getItem("hl_user") || "null");
if (!token || !user || user.role !== "farmer") window.location.href = "login.html";

function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }; }
function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("show"), 2800);
}

let listings = [];

async function load() {
  const res = await fetch("/api/produce/mine", { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) return;
  listings = data.listings || [];
  render();
}

function render() {
  const tbody = document.getElementById("tbody");
  const empty = document.getElementById("empty");
  document.getElementById("countLabel").textContent = `${listings.length} listing${listings.length === 1 ? "" : "s"}`;
  if (listings.length === 0) {
    tbody.innerHTML = ""; empty.style.display = "block"; return;
  }
  empty.style.display = "none";
  tbody.innerHTML = listings.map((l) => `
    <tr>
      <td>${esc(l.crop_name)}</td>
      <td>${l.available_quantity ?? l.quantity} ${esc(l.unit)}</td>
      <td>${l.price_per_unit ? `RWF ${l.price_per_unit}` : "—"}</td>
      <td>${esc(l.district || "—")}</td>
      <td><span class="status-chip ${l.status}">${l.status}</span></td>
      <td class="actions">
        <button class="mini-btn" onclick="openEdit(${l.listing_id})">Edit</button>
        <button class="mini-btn" onclick="markSold(${l.listing_id})">Mark sold</button>
        <button class="mini-btn danger" onclick="del(${l.listing_id})">Delete</button>
      </td>
    </tr>`).join("");
}

const overlay = document.getElementById("modalOverlay");
document.getElementById("addBtn").addEventListener("click", () => openAdd());
document.getElementById("cancelBtn").addEventListener("click", () => overlay.classList.remove("show"));

function openAdd() {
  document.getElementById("modalTitle").textContent = "Add listing";
  document.getElementById("form").reset();
  document.getElementById("listing_id").value = "";
  overlay.classList.add("show");
}
function openEdit(id) {
  const l = listings.find((x) => x.listing_id === id);
  if (!l) return;
  document.getElementById("modalTitle").textContent = "Edit listing";
  document.getElementById("listing_id").value = id;
  document.getElementById("crop_name").value = l.crop_name || "";
  document.getElementById("quantity").value = l.quantity || "";
  document.getElementById("unit").value = l.unit || "kg";
  document.getElementById("price_per_unit").value = l.price_per_unit || "";
  document.getElementById("district").value = l.district || "";
  document.getElementById("sector").value = l.sector || "";
  document.getElementById("harvest_date").value = l.harvest_date ? l.harvest_date.split("T")[0] : "";
  document.getElementById("description").value = l.description || "";
  overlay.classList.add("show");
}

document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("listing_id").value;
  const formData = new FormData();
  formData.append("crop_name", document.getElementById("crop_name").value.trim());
  formData.append("quantity", document.getElementById("quantity").value);
  formData.append("unit", document.getElementById("unit").value);
  formData.append("price_per_unit", document.getElementById("price_per_unit").value || "");
  formData.append("district", document.getElementById("district").value.trim());
  formData.append("sector", document.getElementById("sector").value.trim());
  formData.append("harvest_date", document.getElementById("harvest_date").value || "");
  formData.append("description", document.getElementById("description").value.trim());
  const img = document.getElementById("image").files[0];
  if (img) formData.append("image", img);

  const res = await fetch(id ? `/api/produce/${id}` : "/api/produce", {
    method: id ? "PUT" : "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || "Could not save."); return; }
  showToast(id ? "Listing updated." : "Listing added.");
  overlay.classList.remove("show");
  load();
});

async function markSold(id) {
  await fetch(`/api/produce/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ status: "sold" }) });
  load();
}
async function del(id) {
  if (!confirm("Remove this listing?")) return;
  await fetch(`/api/produce/${id}`, { method: "DELETE", headers: authHeaders() });
  load();
}

load();