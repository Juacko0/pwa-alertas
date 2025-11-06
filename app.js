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

  // ⚙️ Cargar alertas
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

  await cargarAlertas();

  // 🧠 SERVICE WORKER + PUSH
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
        return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
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
      console.log("📡 Suscripción enviada al backend");
    } catch (error) {
      console.error("❌ Error al registrar Service Worker o Push:", error);
    }
  }

  // 📩 Escuchar mensajes del Service Worker
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.tipo === "alerta") {
      mostrarModalAtencion(event.data.mensaje);
    }
  });

  // 🪟 Mostrar modal de atención
  function mostrarModalAtencion(alerta) {
    const modal = document.getElementById("modalAtencion");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const codigo = user?.codigo || "Desconocido";

    document.getElementById("modalUbicacion").textContent = alerta.location || "Ubicación no especificada";
    document.getElementById("comentarioAdicional").value = "";

    modal.classList.add("show");

    document.getElementById("btnCancelarModal").onclick = () => {
      modal.classList.remove("show");
    };

    document.getElementById("btnRegistrarAtencion").onclick = async () => {
      const detalle = document.getElementById("comentarioAdicional").value;
      await registrarAtencion(codigo, alerta, detalle);
      modal.classList.remove("show");
      await cargarAlertas();
    };
  }

  // 🗄️ Registrar atención
  async function registrarAtencion(codigo, alerta, detalle) {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${backendURL}/api/incidents/addIncident`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          atendidoPor: codigo,
          detalleExtra: detalle,
          location: alerta.location || "Ubicación no especificada",
          detail: alerta.detail || "Sin detalle",
          state: "Atendido",
          intervention: {
            attendedAt: new Date().toISOString(),
            attendedBy: codigo,
          },
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
