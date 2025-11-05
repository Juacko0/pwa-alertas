const backendURL = "https://pwa-alertas.onrender.com";

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const lista = document.getElementById("alertas-lista");
  const btnLogout = document.getElementById("btnLogout");
  const btnHistorial = document.getElementById("btnHistorial");
  const userData = JSON.parse(localStorage.getItem("user"));
  const userName = document.getElementById("user-name");

  // 🔐 Verificar sesión
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // 👤 Mostrar nombre del usuario logueado
  if (userName) {
    userName.textContent = `👤 Bienvenido, ${userData?.nombre || "Usuario"}`;
  }

  // 🚪 Cerrar sesión
  btnLogout.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });

  // ⚙️ Función para cargar alertas (activas o historial)
  const cargarAlertas = async (tipo = "listIncidents") => {
    lista.innerHTML = `<div class="loader"></div>`;
    try {
      const res = await fetch(`${backendURL}/api/incidents/${tipo}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      lista.innerHTML = "";
      if (!data.length) {
        lista.innerHTML = `<p class="sin-alertas">✅ No hay alertas ${
          tipo === "listIncidents" ? "activas" : "en el historial"
        }.</p>`;
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
  };

  // 🚀 Cargar alertas activas al inicio
  await cargarAlertas();

  // 🕒 Ver historial
  if (btnHistorial) {
    btnHistorial.addEventListener("click", async () => {
      btnHistorial.disabled = true;
      btnHistorial.textContent = "Cargando...";
      await cargarAlertas("historial");
      btnHistorial.textContent = "🕒 Ver Historial Completo";
      btnHistorial.disabled = false;
    });
  }

  // 🧠 REGISTRO DE SERVICE WORKER + SUSCRIPCIÓN PUSH
  if ("serviceWorker" in navigator && "PushManager" in window) {
    try {
      console.log("✅ Service Worker registrado:", registration);

      // Obtener clave pública del backend
      const vapidRes = await fetch(`${backendURL}/api/notifications/vapidPublicKey`);
      const vapidPublicKey = await vapidRes.text();

      // Convertir clave base64 a formato Uint8Array
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

      // Verificar si ya está suscrito
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

      // Enviar suscripción al backend
      const profesionalCodigo = userData?.codigo || null;
      await fetch(`${backendURL}/api/notifications/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscription, profesionalCodigo }),
      });

      console.log("📡 Suscripción registrada con el backend");
    } catch (error) {
      console.error("❌ Error al registrar el Service Worker o Push:", error);
    }
  } else {
    console.warn("⚠️ Este navegador no soporta Service Workers o Push API.");
  }
});
