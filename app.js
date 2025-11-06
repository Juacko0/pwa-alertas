const backendURL = "https://backend-alertas-laborales.onrender.com";

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const lista = document.getElementById("alertas-lista");
  const btnLogout = document.getElementById("btnLogout");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  btnLogout.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });

  await cargarAlertas();
  await registrarServiceWorkerYSuscripcion();

  let incidenteSeleccionado = null; // 🔹 Guardará el ID del incidente actual

  // -----------------------
  // Escucha de notificaciones
  // -----------------------
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.tipo === "alerta") {
        const payload = parseAlertaPayload(event.data.mensaje);
        mostrarModalAtencion(payload);
      }
    });
  }

  window.addEventListener("message", (ev) => {
    if (ev.data?.tipo === "alerta") {
      mostrarModalAtencion(parseAlertaPayload(ev.data.mensaje));
    }
  });

  // -----------------------
  // Función: Cargar alertas
  // -----------------------
  async function cargarAlertas() {
    try {
      const res = await fetch(`${backendURL}/api/incidents/listIncidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      lista.innerHTML = "";
      if (!Array.isArray(data) || data.length === 0) {
        lista.innerHTML = `<p class="sin-alertas">✅ No hay alertas activas.</p>`;
        return;
      }

      data.forEach((alerta) => {
        const card = document.createElement("div");
        card.className = "alerta-card";
        card.innerHTML = `
          <h3>${escapeHtml(alerta.residentName) || "No registrado"}</h3>
          <p><strong>Ubicación:</strong> ${escapeHtml(alerta.location || "Ubicación no especificada")}</p>
          <p><strong>Detalle:</strong> ${escapeHtml(alerta.detail || "Sin detalle")}</p>
          <p><strong>Estado:</strong> ${escapeHtml(alerta.state || "Pendiente")}</p>
          ${alerta.state === "Atendido" ? `
            <p><strong>Atendido por:</strong> ${escapeHtml(alerta.intervention?.attendedBy || "—")}</p>
            <p><strong>Nivel de lesión:</strong> ${escapeHtml(String(alerta.intervention?.injuryLevel || "N/A"))}</p>
            <p><strong>Hora de atención:</strong> ${
              alerta.intervention?.attendedAt
                ? new Date(alerta.intervention.attendedAt).toLocaleString("es-PE")
                : "—"
            }</p>
          ` : ""}
          <p><small>Registrado: ${new Date(alerta.createdAt || alerta.time || Date.now()).toLocaleString("es-PE")}</small></p>
          ${alerta.state !== "Atendido" ? `<button class="btn-atender" data-id="${alerta._id}">Atender</button>` : ""}
        `;
        lista.appendChild(card);
      });

      // Asociar botones "Atender"
      document.querySelectorAll(".btn-atender").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          const alerta = data.find((a) => a._id === id);
          if (!alerta) {
            alert("⚠️ No se encontró la alerta seleccionada.");
            return;
          }
          mostrarModalAtencion(alerta);
        });
      });
    } catch (err) {
      console.error("❌ Error al cargar alertas:", err);
      lista.innerHTML = "<p>❌ No se pudieron cargar las alertas.</p>";
    }
  }

  // -----------------------
  // Registrar Service Worker
  // -----------------------
  async function registrarServiceWorkerYSuscripcion() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("⚠️ Este navegador no soporta Service Workers o Push API.");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("/service-workers.js");
      console.log("✅ Service Worker registrado:", registration);

      const permission = await Notification.requestPermission();
      console.log("🔔 Permiso de notificación:", permission);
      if (permission !== "granted") return;

      const vapidRes = await fetch(`${backendURL}/api/notifications/vapidPublicKey`);
      const vapidPublicKey = await vapidRes.text();

      const urlBase64ToUint8Array = (base64String) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
      };

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        console.log("🆕 Nueva suscripción creada");
      } else {
        console.log("🔁 Suscripción existente");
      }

      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      const profesionalCodigo = userData?.codigo;
      if (!profesionalCodigo) {
        console.warn("⚠️ No se encontró el código del profesional en localStorage");
        return;
      }

      await fetch(`${backendURL}/api/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, profesionalCodigo }),
      });
      console.log("📡 Suscripción enviada al backend");
    } catch (err) {
      console.error("❌ Error al registrar SW/suscripción:", err);
    }
  }

  // -----------------------
  // Modal de atención
  // -----------------------
  function mostrarModalAtencion(alerta) {
  const modal = document.getElementById("modalAtencion");
  if (!modal) return console.error("❌ No existe #modalAtencion en el DOM");

  console.log("🧩 Datos de la alerta recibida:", alerta);

  // Detectar ID correctamente (puede ser _id, id o incidentId)
  const incidenteID = alerta._id || alerta.id || alerta.incidentId || null;
  if (!incidenteID) {
    console.warn("⚠️ No se puede abrir el modal: alerta sin ID válido.");
    alert("⚠️ No se puede abrir el modal: alerta sin ID válido.");
    return;
  }

  // Guardar el ID globalmente
  incidenteSeleccionado = incidenteID;

  // Referencias
  const locInp = document.getElementById("input-location");
  const resInp = document.getElementById("input-resident");
  const detailInp = document.getElementById("input-detail");
  const isFallInp = document.getElementById("input-isFall");
  const huboInp = document.getElementById("input-huboIntervencion");
  const levelSel = document.getElementById("input-injuryLevel");
  const extraInp = document.getElementById("input-detalleExtra");

  // Rellenar datos
  locInp.value = alerta.location || "";
  resInp.value = alerta.residentName || "";
  detailInp.value = alerta.detail || "";
  isFallInp.checked = Boolean(alerta.isFall);
  huboInp.checked = Boolean(alerta.intervention?.huboIntervencion);
  levelSel.value = String(alerta.intervention?.injuryLevel || "1");
  extraInp.value = "";

  // Mostrar modal
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  // Botones
  const btnCancelar = document.getElementById("btnCancelarModal");
  const btnRegistrar = document.getElementById("btnRegistrarAtencion");

  btnCancelar.onclick = () => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  };

  btnRegistrar.onclick = async () => {
    if (!incidenteSeleccionado) {
      alert("⚠️ No se encontró el ID del incidente.");
      return;
    }

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const codigo = user?.codigo || "Desconocido";
    const horaAtencion = new Date().toISOString();

    const bodyData = {
      attendedBy: codigo,
      injuryLevel: parseInt(levelSel.value, 10) || 1,
      attendedAt: horaAtencion,
      confirmedBy: codigo,
    };

    try {
      const res = await fetch(`${backendURL}/api/incidents/addIntervention/${incidenteSeleccionado}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Error registrando atención");
      }

      alert("✅ Intervención registrada correctamente");
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
      await cargarAlertas();
    } catch (err) {
      console.error("❌ Error al registrar intervención:", err);
      alert("⚠️ No se pudo registrar la intervención. Revisa la consola.");
    }
  };
}

  function limpiarCamposModal() {
    document.getElementById("input-location").value = "";
    document.getElementById("input-resident").value = "";
    document.getElementById("input-detail").value = "";
    document.getElementById("input-isFall").checked = false;
    document.getElementById("input-huboIntervencion").checked = false;
    document.getElementById("input-injuryLevel").value = "1";
    document.getElementById("input-detalleExtra").value = "";
  }

  // -----------------------
  // Utilidad para sanitizar HTML
  // -----------------------
  function escapeHtml(str = "") {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseAlertaPayload(payload) {
    if (!payload) return { detail: "Nueva alerta" };
    try {
      if (typeof payload === "string") {
        try {
          return JSON.parse(payload);
        } catch {
          return { detail: payload };
        }
      } else if (typeof payload === "object") {
        return payload;
      }
      return { detail: String(payload) };
    } catch {
      return { detail: "Nueva alerta" };
    }
  }
});
