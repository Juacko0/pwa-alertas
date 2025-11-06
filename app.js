const backendURL = "https://backend-alertas-laborales.onrender.com";

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const lista = document.getElementById("alertas-lista");
  const btnLogout = document.getElementById("btnLogout");

  // Si no hay token, redirige a login
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  btnLogout.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });

  // Cargar alertas al inicio
  await cargarAlertas();

  // Registrar SW y suscripción push (si aplica)
  await registrarServiceWorkerYSuscripcion();

  // Escuchar mensajes provenientes del Service Worker
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.tipo === "alerta") {
        // puede venir como string o como objeto
        const payload = parseAlertaPayload(event.data.mensaje);
        mostrarModalAtencion(payload);
      }
    });
  }

  // También escuchar window.postMessage fallback (opcional)
  window.addEventListener("message", (ev) => {
    if (ev.data?.tipo === "alerta") {
      mostrarModalAtencion(parseAlertaPayload(ev.data.mensaje));
    }
  });

  // -----------------------
  // Funciones
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
            <p><strong>Hora de atención:</strong> ${alerta.intervention?.attendedAt ? new Date(alerta.intervention.attendedAt).toLocaleString() : "—"}</p>
          ` : ""}
          <p><small>Registrado: ${new Date(alerta.createdAt || alerta.time || Date.now()).toLocaleString()}</small></p>
        `;
        lista.appendChild(card);
      });
    } catch (err) {
      console.error("❌ Error al cargar alertas:", err);
      lista.innerHTML = "<p>❌ No se pudieron cargar las alertas.</p>";
    }
  }

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

  function parseAlertaPayload(payload) {
    // payload puede ser string (texto) o objeto serializado
    if (!payload) return { detail: "Nueva alerta" };
    try {
      if (typeof payload === "string") {
        // intentar parsear JSON o tratar como detalle de texto
        try {
          const parsed = JSON.parse(payload);
          return parsed;
        } catch {
          return { detail: payload };
        }
      } else if (typeof payload === "object") {
        return payload;
      } else {
        return { detail: String(payload) };
      }
    } catch {
      return { detail: "Nueva alerta" };
    }
  }

  // -----------------------
  // Modal editable (llama addIncident con la estructura de tu model)
  // -----------------------
  function mostrarModalAtencion(alertaObjeto) {
    const alerta = parseAlertaPayload(alertaObjeto);
    const modal = document.getElementById("modalAtencion");
    if (!modal) {
      console.error("❌ No existe #modalAtencion en el DOM");
      return;
    }

    // Prefill inputs (si vienen vacíos, quedan en blanco para que el usuario complete)
    const locInp = document.getElementById("input-location");
    const resInp = document.getElementById("input-resident");
    const detailInp = document.getElementById("input-detail");
    const isFallInp = document.getElementById("input-isFall");
    const huboInp = document.getElementById("input-huboIntervencion");
    const levelSel = document.getElementById("input-injuryLevel");
    const extraInp = document.getElementById("input-detalleExtra");

    locInp.value = alerta.location || "";
    resInp.value = alerta.residentName || "";
    detailInp.value = alerta.detail || (typeof alerta === "string" ? alerta : "");
    isFallInp.checked = Boolean(alerta.isFall);
    huboInp.checked = Boolean(alerta.intervention?.huboIntervencion);
    levelSel.value = String(alerta.intervention?.injuryLevel || "1");
    extraInp.value = "";

    // mostrar modal
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    // registrar cuándo se recibió la alerta
    const receivedAt = new Date().toISOString();

    // botones
    const btnCancelar = document.getElementById("btnCancelarModal");
    const btnRegistrar = document.getElementById("btnRegistrarAtencion");

    // remover listeners previos (por si existían)
    btnCancelar.onclick = null;
    btnRegistrar.onclick = null;

    btnCancelar.onclick = () => {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    };

    btnRegistrar.onclick = async () => {
      // armar objeto que respete tu schema
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const codigo = user?.codigo || null;

      const incidentData = {
        location: locInp.value.trim() || "Ubicación no especificada",
        time: new Date().toISOString(),
        residentName: resInp.value.trim() || "No registrado",
        detail: detailInp.value.trim() || "Sin detalle",
        state: "Atendido",
        isFall: Boolean(isFallInp.checked),
        confirmedBy: codigo,
        intervention: {
          huboIntervencion: Boolean(huboInp.checked),
          receivedAt: receivedAt,
          attendedAt: new Date().toISOString(),
          attendedBy: codigo,
          injuryLevel: parseInt(levelSel.value, 10) || 1
        },
        // campo extra libre
        detalleExtra: extraInp.value.trim() || ""
      };

      try {
        const tokenLocal = localStorage.getItem("token");
        const res = await fetch(`${backendURL}/api/incidents/addIncident`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenLocal}`,
          },
          body: JSON.stringify(incidentData),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Error registrando atención");
        }

        alert("✅ Atención registrada correctamente");
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        await cargarAlertas();
      } catch (err) {
        console.error("❌ Error al registrar atención:", err);
        alert("⚠️ No se pudo registrar la atención. Revisa la consola.");
      }
    };
  }

  // util: escapar texto simple para insertar en innerHTML cuando no usamos plantilla segura
  function escapeHtml(str = "") {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});
