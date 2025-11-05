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

  const modal = document.createElement("div");
  modal.id = "modalAtencion";
  modal.className = "fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50";

  modal.innerHTML = `
    <div class="bg-white text-black rounded-2xl shadow-xl p-6 w-96 max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl font-bold mb-4">🚨 Nueva Alerta</h2>

      <p class="text-gray-700 mb-2"><b>location:</b> ${alerta.location || "No especificada"}</p>
      <p class="text-gray-700 mb-2"><b>Residente:</b> ${alerta.residentName || "No registrado"}</p>
      <p class="text-gray-700 mb-2"><b>detail:</b> ${alerta.detail || "Sin detalle"}</p>

      <hr class="my-3">

      <p class="text-sm text-gray-600 mb-2">Atendido por: <span class="font-bold">${codigo}</span></p>
      <textarea id="detail" class="border w-full p-1 mb-3" placeholder="Detalles adicionales..."></textarea>

      <div class="flex justify-center space-x-2">
        <button id="btnCancelarAtencion" class="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded">Cancelar</button>
        <button id="btnConfirmarAtencion" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">Confirmar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Cerrar modal
  document.getElementById("btnCancelarAtencion").onclick = () => modal.remove();

  // Confirmar atención
  document.getElementById("btnConfirmarAtencion").onclick = async () => {
    const detalleExtra = document.getElementById("detalleIncidente").value.trim();

    await registrarAtencion({
      id: alerta._id,
      atendidoPor: codigo,
      ubicacion: alerta.location,
      detalleExtra
    });

    modal.remove();
    await cargarAlertas();
  };
}

// 🗄️ ENVIAR AL BACKEND QUIÉN ATENDIÓ LA ALERTA
async function registrarAtencion(data) {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`${backendURL}/api/incidents/addIncident`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error(await res.text());
    alert("✅ Atención registrada correctamente");
  } catch (error) {
    console.error("❌ Error al registrar atención:", error);
    alert("⚠️ No se pudo registrar la atención");
  }
}
});
