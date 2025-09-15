const API_BASE_URL = import.meta.env.VITE_API_URL || "https://gestioncommandesapi.agreeablepebble-e135b62f.westeurope.azurecontainerapps.io";
const API_URL = `${API_BASE_URL}/api/commandes`;

const form = document.getElementById("demo-form");
const result = document.getElementById("demo-result");

if (!document.getElementById("client-name")) {
  const nameInput = document.createElement("input");
  nameInput.id = "client-name";
  nameInput.placeholder = "Nom du client";
  nameInput.required = true;

  const totalInput = document.createElement("input");
  totalInput.id = "total";
  totalInput.type = "number";
  totalInput.step = "0.01";
  totalInput.placeholder = "Montant (€)";
  totalInput.required = true;

  const addBtn = document.createElement("button");
  addBtn.id = "add-command";
  addBtn.type = "button";
  addBtn.textContent = "➕ Ajouter une Commande";

  form.append(nameInput, totalInput, addBtn);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
}

function formatCommandes(list) {
  if (!Array.isArray(list) || !list.length)
    return "<span style='color:#888'>Aucune commande.</span>";

  return `<ol class="demo-list">${list
    .map(
      (cmd) =>
        `<li>
          <b>${escapeHtml(cmd.nomClient || "Inconnu")}</b>
          — <span>${(typeof cmd.total === 'number' ? cmd.total.toFixed(2) : "0.00")} €</span>
          <br>
          <small>${new Date(cmd.dateCommande).toLocaleString("fr-FR")}</small>
        </li>`
    )
    .join("")}</ol>`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  result.textContent = "⏳ Chargement...";
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`Erreur API (${res.status})`);
    result.innerHTML = formatCommandes(await res.json());
  } catch (err) {
    result.textContent = `❌ ${err.message}`;
  }
});

document.getElementById("add-command").addEventListener("click", async () => {
  const nomClient = document.getElementById("client-name").value.trim();
  const total = parseFloat(document.getElementById("total").value.replace(",", "."));

  if (!nomClient || isNaN(total)) {
    result.textContent = "❌ Champs invalides.";
    return;
  }

  const body = JSON.stringify({ nomClient, dateCommande: new Date(), total });

  result.textContent = "⏳ Envoi...";
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (!res.ok) throw new Error(`Erreur API (${res.status})`);
    result.textContent = "✅ Commande ajoutée !";
    form.requestSubmit();
  } catch (err) {
    result.textContent = `❌ ${err.message}`;
  }
});
