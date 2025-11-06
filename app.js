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

  // 🧭 Cargar alertas
  async function cargarAlertas() {
    try {
      const res = await fetch(`${backendURL}/api/incidents/listIncidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      lista.innerHTML = "";

      if (!data.length) {
        lista.innerHTML = `<p class="sin-alertas">✅ No hay alertas activas.</p>`;
        return;
      }

      data.forEach((alerta) => {
        const card = document.createElement("div");
        card.className = "alerta-card futuristic-card";
        card.innerHTML = `
          <h3>${alerta.location || "Ubicación no especificada"}</h3>
          <p>${alerta.detail || "Sin detalle"}</p>
          <p><b>Residente:</b> ${alerta.residentName || "No registrado"}</p>
          <p><b>Estado:</b> ${alerta.state}</p>
          ${
            alerta.state === "Atendido"
              ? `<p><b>Atendido por:</b> ${alerta.intervention?.attendedBy || "—"}</p>
                 <p><b>Nivel de lesión:</b> ${alerta.intervention?.injuryLevel || "N/A"}</p>`
              : ""
          }
          <p><b>Registrado:</b> ${new Date(alerta.createdAt).toLocaleString()}</p>
        `;
        lista.appendChild(card);
      });
    } catch (err) {
      console.error("❌ Error al cargar alertas:", err);
      lista.innerHTML = "<p>❌ No se pudieron cargar las alertas.</p>";
    }
  }

  await cargarAlertas();

  // 🔔 Service Worker y Push Notifications
  if ("serviceWorker" in navigator && "PushManager" in window) {
    try {
      const registration = await navigator.serviceWorker.register("/service-workers.js");
      console.log("✅ Service Worker registrado:", registration);

      const permission = await Notification.requestPermission();
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
      }

      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      const profesionalCodigo = userData?.codigo;
      if (!profesionalCodigo) return;

      await fetch(`${backendURL}/api/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, profesionalCodigo }),
      });
    } catch (error) {
      console.error("❌ Error con Service Worker o Push:", error);
    }
  }

  // 🧠 Recibir mensajes del SW
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.tipo === "alerta") {
      mostrarModalAtencion(event.data.mensaje);
    }
  });

  // 🪟 Modal de atención
  function mostrarModalAtencion(alerta) {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const codigo = user?.codigo || "Desconocido";

    if (document.getElementById("modalAtencion")) return;

    const modal = document.createElement("div");
    modal.id = "modalAtencion";
    modal.className = "modal-overlay";

    modal.innerHTML = `
      <div class="modal-content">
        <h2>🚨 Nueva Alerta</h2>
        <p><b>Ubicación:</b> ${alerta.location || "No especificada"}</p>
        <p><b>Residente:</b> ${alerta.residentName || "No registrado"}</p>
        <p><b>Descripción:</b> ${alerta.detail || "Sin detalle"}</p>
        <p><b>Estado:</b> ${alerta.state || "Pendiente"}</p>

        <hr>

        <p><b>Atendido por:</b> ${codigo}</p>
        <label>Nivel de lesión:</label>
        <select id="injuryLevel" class="select-input">
          <option value="1">Leve</option>
          <option value="2">Moderada</option>
          <option value="3">Grave</option>
        </select>

        <textarea id="detalleExtra" placeholder="Detalles adicionales..."></textarea>

        <div class="btn-group">
          <button id="btnCancelarAtencion" class="btn-cancelar">Cancelar</button>
          <button id="btnConfirmarAtencion" class="btn-confirmar">Confirmar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btnCancelarAtencion").onclick = () => modal.remove();

    document.getElementById("btnConfirmarAtencion").onclick = async () => {
      const injuryLevel = document.getElementById("injuryLevel").value;
      const detalleExtra = document.getElementById("detalleExtra").value;

      await registrarAtencion(codigo, alerta, detalleExtra, injuryLevel);
      modal.remove();
      await cargarAlertas();
    };
  }

  // 📡 Registrar atención
  async function registrarAtencion(codigo, alerta, detalleExtra, injuryLevel) {
    try {
      const res = await fetch(`${backendURL}/api/incidents/registerAttention`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          atendidoPor: codigo,
          id: alerta._id,
          injuryLevel: parseInt(injuryLevel),
          detalleExtra,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      alert("✅ Atención registrada correctamente");
    } catch (error) {
      console.error("❌ Error al registrar atención:", error);
      alert("⚠️ No se pudo registrar la atención");
    }
  }
});
