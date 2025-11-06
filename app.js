document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ Página de alertas cargada");
  obtenerAlertas();
  iniciarSocket(); // Para notificaciones en tiempo real
});

// ===============================
// 🔄 Obtener alertas activas
// ===============================
async function obtenerAlertas() {
  const contenedor = document.getElementById("alertas-lista");
  contenedor.innerHTML = "<p>Cargando alertas...</p>";

  try {
    const res = await fetch("https://backend-alertas-laborales.onrender.com/api/incidents");
    const incidentes = await res.json();

    if (!incidentes.length) {
      contenedor.innerHTML = "<p>No hay alertas registradas.</p>";
      return;
    }

    contenedor.innerHTML = "";
    incidentes.forEach((inc) => {
      const div = document.createElement("div");
      div.className = `alerta ${inc.state === "Pendiente" ? "pendiente" : "atendida"}`;
      div.innerHTML = `
        <h3>${inc.residentName || "Sin nombre"}</h3>
        <p><strong>Ubicación:</strong> ${inc.location}</p>
        <p><strong>Detalle:</strong> ${inc.detail || "Sin detalle"}</p>
        <p><strong>Estado:</strong> ${inc.state}</p>
        <p><strong>Registrado:</strong> ${new Date(inc.time).toLocaleString()}</p>
      `;
      contenedor.appendChild(div);
    });
  } catch (err) {
    console.error("❌ Error al cargar alertas:", err);
    document.getElementById("alertas-lista").innerHTML = "<p>Error al obtener las alertas.</p>";
  }
}

// ===============================
// 🧠 WebSocket / Simulación de alerta
// ===============================
function iniciarSocket() {
  console.log("🌐 Escuchando nuevas alertas...");
  // Simulación: crear modal cuando llega alerta
  setTimeout(() => {
    abrirModalAtencion({
      location: "Ubicación no especificada",
      residentName: "",
      detail: "",
      intervention: { injuryLevel: 1, huboIntervencion: false },
      isFall: false,
      state: "Pendiente",
    });
  }, 2000);
}

// ===============================
// 🧱 Modal de atención editable
// ===============================
function abrirModalAtencion(incidente) {
  if (document.getElementById("modal-atencion")) return;

  const modal = document.createElement("div");
  modal.id = "modal-atencion";
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal-content">
      <h2>🚨 Nueva Alerta</h2>

      <label>📍 Ubicación:</label>
      <input id="inp-location" type="text" class="input" value="${incidente.location || ""}">

      <label>👤 Residente:</label>
      <input id="inp-resident" type="text" class="input" value="${incidente.residentName || ""}">

      <label>📝 Detalle:</label>
      <textarea id="inp-detail" class="input" rows="2" placeholder="Describe el incidente...">${incidente.detail || ""}</textarea>

      <div class="check-group">
        <input type="checkbox" id="inp-isFall" ${incidente.isFall ? "checked" : ""}>
        <label for="inp-isFall">💥 Fue una caída real</label>
      </div>

      <div class="check-group">
        <input type="checkbox" id="inp-huboIntervencion" ${incidente.intervention?.huboIntervencion ? "checked" : ""}>
        <label for="inp-huboIntervencion">🩺 Hubo intervención</label>
      </div>

      <label>⚕️ Nivel de lesión:</label>
      <select id="inp-injuryLevel" class="input">
        <option value="1" ${incidente.intervention?.injuryLevel === 1 ? "selected" : ""}>1 - Leve</option>
        <option value="2" ${incidente.intervention?.injuryLevel === 2 ? "selected" : ""}>2 - Moderada</option>
        <option value="3" ${incidente.intervention?.injuryLevel === 3 ? "selected" : ""}>3 - Grave</option>
      </select>

      <div class="modal-buttons">
        <button id="btn-cancelar" class="btn-cancelar">Cancelar</button>
        <button id="btn-guardar" class="btn-guardar">Aceptar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("btn-cancelar").onclick = () => modal.remove();
  document.getElementById("btn-guardar").onclick = () => registrarAtencion(modal);
}

// ===============================
// 💾 Registrar atención
// ===============================
async function registrarAtencion(modal) {
  const incidente = {
    location: document.getElementById("inp-location").value || "Ubicación no especificada",
    residentName: document.getElementById("inp-resident").value || "No registrado",
    detail: document.getElementById("inp-detail").value || "Sin detalle",
    isFall: document.getElementById("inp-isFall").checked,
    confirmedBy: window.userData?.nombre || "Personal Geriátrico",
    intervention: {
      huboIntervencion: document.getElementById("inp-huboIntervencion").checked,
      receivedAt: new Date(),
      attendedAt: new Date(),
      attendedBy: window.userData?.nombre || "Desconocido",
      injuryLevel: parseInt(document.getElementById("inp-injuryLevel").value),
    },
    state: "Atendido",
  };

  try {
    const res = await fetch("https://backend-alertas-laborales.onrender.com/api/incidents/addIncident", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(incidente),
    });

    if (!res.ok) throw new Error("Error al registrar la atención");

    alert("✅ Atención registrada correctamente");
    modal.remove();
    obtenerAlertas();
  } catch (err) {
    console.error("❌ Error al guardar atención:", err);
    alert("Error al registrar la atención. Revisa la consola.");
  }
}
