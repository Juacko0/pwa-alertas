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
      // Registrar el Service Worker (nombre corregido)
      const registration = await navigator.serviceWorker.register("/service-workers.js");
      console.log("✅ Service Worker registrado:", registration);

      // Solicitar permiso de notificación al usuario
      const permission = await Notification.requestPermission();
      console.log("🔔 Permiso de notificación:", permission);
      if (permission !== "granted") {
        console.warn("⚠️ Permiso de notificación denegado.");
        return;
      }

      // Obtener clave pública desde el backend
      const vapidRes = await fetch(`${backendURL}/api/notifications/vapidPublicKey`);
      const vapidPublicKey = await vapidRes.text();

      // Función para convertir clave base64 a Uint8Array
      const urlBase64ToUint8Array = (base64String) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      // Verificar si ya existe una suscripción
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        console.log("🆕 Nueva suscripción creada:", subscription);
      } else {
        console.log("🔁 Ya existe una suscripción:", subscription);
      }

      // Enviar la suscripción al backend junto con el código del profesional
      const userString = localStorage.getItem("user");
      const userData = userString ? JSON.parse(userString) : null;
      const profesionalCodigo = userData?.codigo || null;

      if (!profesionalCodigo) {
        console.warn("⚠️ No se encontró el código del profesional. No se puede vincular la suscripción.");
        return;
      }

      console.log("📡 Enviando suscripción al backend...");
      const res = await fetch(`${backendURL}/api/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, profesionalCodigo }),
      });

      if (res.ok) {
        console.log(`✅ Suscripción vinculada correctamente al profesional ${profesionalCodigo}`);
      } else {
        console.error("❌ Error al registrar la suscripción:", await res.text());
      }
    } catch (error) {
      console.error("❌ Error al registrar el Service Worker o Push:", error);
    }
  } else {
    console.warn("⚠️ Este navegador no soporta Service Workers o Push API.");
  }

  navigator.serviceWorker.addEventListener("message", (event) => {
  if (event.data?.tipo === "alerta") {
    mostrarModalAtencion(event.data.mensaje);
  }
});

// 🪟 FUNCION PARA MOSTRAR EL MODAL DE ATENCIÓN
function mostrarModalAtencion(mensaje) {
  const user = JSON.parse(localStorage.getItem("user"));
  const codigo = user?.codigo || "Desconocido";

  // Si ya existe un modal abierto, no crear otro
  if (document.getElementById("modalAtencion")) return;

  const modal = document.createElement("div");
  modal.id = "modalAtencion";
  modal.className = "fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl p-6 w-80 text-center">
      <h2 class="text-lg font-bold mb-3">🚨 Nueva Alerta</h2>
      <p class="text-gray-700 mb-4">${mensaje}</p>
      <p class="text-sm text-gray-600 mb-4">
        Atendido por: <span class="font-bold">${codigo}</span>
      </p>
      <div class="flex justify-center space-x-2">
        <button id="btnCancelarAtencion" class="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded">Cancelar</button>
        <button id="btnConfirmarAtencion" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("btnCancelarAtencion").onclick = () => modal.remove();
  document.getElementById("btnConfirmarAtencion").onclick = async () => {
    await registrarAtencion(codigo, mensaje);
    alert("✅ Atención registrada correctamente");
    modal.remove();
  };
}

// 🗄️ ENVIAR AL BACKEND QUIÉN ATENDIÓ LA ALERTA
async function registrarAtencion(codigo, mensaje) {
  try {
    const res = await fetch(`${backendURL}/api/incidents/registerAttention`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        atendidoPor: codigo,
        detalle: mensaje,
      }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }
  } catch (error) {
    console.error("❌ Error al registrar atención:", error);
    alert("⚠️ No se pudo registrar la atención");
  }
}
});
