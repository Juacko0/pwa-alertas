const backendURL = "https://backend-alertas-laborales.onrender.com";

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const lista = document.getElementById("alertas-lista");
  const btnLogout = document.getElementById("btnLogout");

  // 🔐 Verificar sesión
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // 🚪 Cerrar sesión
  btnLogout.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });

  // ⚙️ Función para cargar alertas
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
          <h3>${alerta.location}</h3>
          <p>${alerta.detail}</p>
          <p><b>Estado:</b> ${alerta.state}</p>
          <p><b>Registrado:</b> ${new Date(alerta.createdAt).toLocaleString()}</p>
        `;
        lista.appendChild(card);
      });
    } catch (err) {
      console.error("❌ Error al cargar alertas:", err);
      lista.innerHTML = "<p>❌ No se pudieron cargar las alertas.</p>";
    }
  }

  // 🚀 Cargar alertas activas al inicio
  await cargarAlertas();

  // 🧠 REGISTRO DE SERVICE WORKER + SUSCRIPCIÓN PUSH
  if ("serviceWorker" in navigator && "PushManager" in window) {
    try {
      const registration = await navigator.serviceWorker.register("/service-workers.js");
      console.log("✅ Service Worker registrado:", registration);

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("⚠️ Permiso de notificación denegado.");
        return;
      }

      const vapidRes = await fetch(`${backendURL}/api/notifications/vapidPublicKey`);
      const vapidPublicKey = await vapidRes.text();

      const urlBase64ToUint8Array = (base64String) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
      };

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        console.log("🆕 Nueva suscripción creada:", subscription);
      }

      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      const profesionalCodigo = userData?.codigo;
      if (!profesionalCodigo) return;

      await fetch(`${backendURL}/api/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, profesionalCodigo }),
      });
      console.log("📡 Suscripción enviada al backend");
    } catch (error) {
      console.error("❌ Error al registrar Service Worker o Push:", error);
    }
  }

  // 🧠 Escuchar mensajes del SW para mostrar el modal
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.tipo === "alerta") {
      mostrarModalAtencion(event.data.mensaje);
    }
  });

// 🪟 FUNCION PARA MOSTRAR EL MODAL DE ATENCIÓN REAL
function mostrarModalAtencion(alerta) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const codigo = user?.codigo || "Desconocido";

  // Evita abrir múltiples modales
  if (document.getElementById("modalAtencion")) return;

  // Crear fondo y centrar modal
  const modal = document.createElement("div");
  modal.id = "modalAtencion";
  modal.className = `
    fixed inset-0 z-50 flex items-center justify-center 
    bg-black bg-opacity-50
  `;

  modal.innerHTML = `
    <div class="bg-white text-black rounded-2xl shadow-xl p-6 w-11/12 max-w-md max-h-[90vh] overflow-y-auto flex flex-col">
      <h2 class="text-xl font-bold mb-4 text-center">🚨 Nueva Alerta</h2>

      <label class="block mb-1"><b>Ubicación:</b></label>
      <input id="input-location" type="text" class="border w-full p-2 mb-3 rounded" placeholder="Ej: Zona de descanso">

      <label class="block mb-1"><b>Residente:</b></label>
      <input id="input-resident" type="text" class="border w-full p-2 mb-3 rounded" placeholder="Ej: Juan Pérez">

      <label class="block mb-1"><b>Descripción:</b></label>
      <textarea id="input-detail" class="border w-full p-2 mb-3 rounded" rows="3" placeholder="Ej: Caída leve cerca del pasillo"></textarea>

      <div class="flex items-center mb-3">
        <input id="input-isFall" type="checkbox" class="mr-2">
        <label for="input-isFall">💥 Fue una caída real</label>
      </div>

      <div class="flex items-center mb-3">
        <input id="input-huboIntervencion" type="checkbox" class="mr-2">
        <label for="input-huboIntervencion">🩺 Hubo intervención</label>
      </div>

      <label class="block mb-2"><b>Nivel de lesión:</b></label>
      <select id="input-injuryLevel" class="border w-full p-2 mb-4 rounded">
        <option value="1">1 - Leve</option>
        <option value="2">2 - Moderada</option>
        <option value="3">3 - Grave</option>
      </select>

      <hr class="my-3">

      <p class="text-sm text-gray-600 mb-2">Atendido por: <span class="font-bold">${codigo}</span></p>

      <textarea id="detalleIncidente" class="border w-full p-2 mb-3 rounded" placeholder="Detalles adicionales..."></textarea>

      <div class="flex justify-center space-x-2 mt-2">
        <button id="btnCancelarAtencion" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Cancelar</button>
        <button id="btnConfirmarAtencion" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Confirmar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Cancelar
  document.getElementById("btnCancelarAtencion").onclick = () => modal.remove();

  // Confirmar atención
  document.getElementById("btnConfirmarAtencion").onclick = async () => {
    const incidentData = {
      location: document.getElementById("input-location").value || "Ubicación no especificada",
      residentName: document.getElementById("input-resident").value || "No registrado",
      detail: document.getElementById("input-detail").value || "Sin detalle",
      state: document.getElementById("input-huboIntervencion").checked ? "Atendido" : "Pendiente",
      isFall: document.getElementById("input-isFall").checked,
      confirmedBy: codigo,
      intervention: {
        huboIntervencion: document.getElementById("input-huboIntervencion").checked,
        attendedAt: document.getElementById("input-huboIntervencion").checked ? new Date().toISOString() : null,
        attendedBy: document.getElementById("input-huboIntervencion").checked ? codigo : null,
        injuryLevel: parseInt(document.getElementById("input-injuryLevel").value),
      },
      detalleExtra: document.getElementById("detalleIncidente").value
    };

    // Enviar al backend
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${backendURL}/api/incidents/addIncident`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(incidentData),
      });

      if (!res.ok) throw new Error(await res.text());
      alert("✅ Atención registrada correctamente");
      modal.remove();
      await cargarAlertas();
    } catch (error) {
      console.error("❌ Error al registrar atención:", error);
      alert("⚠️ No se pudo registrar la atención");
    }
  };
}

});
