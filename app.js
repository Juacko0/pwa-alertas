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

  // === CARGAR ALERTAS EXISTENTES ===
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
        card.className = "alerta-card";
        card.innerHTML = `
          <h3>${alerta.location}</h3>
          <p><b>Residente:</b> ${alerta.residentName}</p>
          <p>${alerta.detail}</p>
          <p><b>Estado:</b> ${alerta.state}</p>
          ${
            alerta.state === "Atendido"
              ? `<p><b>Atendido por:</b> ${alerta.intervention?.attendedBy}</p>
                 <p><b>Nivel de lesión:</b> ${alerta.intervention?.injuryLevel}</p>`
              : ""
          }
          <p><b>Registrado:</b> ${new Date(alerta.createdAt).toLocaleString()}</p>
        `;
        lista.appendChild(card);
      });
    } catch (err) {
      console.error("❌ Error al cargar alertas:", err);
      lista.innerHTML = "<p>⚠️ No se pudieron cargar las alertas.</p>";
    }
  }

  await cargarAlertas();

  // === ESCUCHAR MENSAJE DEL SERVICE WORKER ===
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.tipo === "alerta") {
      mostrarModalAtencion(event.data.mensaje);
    }
  });

  // === MOSTRAR MODAL ===
  function mostrarModalAtencion(alerta) {
    const modal = document.getElementById("modal-alerta");
    modal.classList.add("show");

    const form = document.getElementById("alertaForm");
    const btnCancelar = document.getElementById("btnCancelar");

    // limpiar formulario
    form.reset();

    btnCancelar.onclick = () => modal.classList.remove("show");

    form.onsubmit = async (e) => {
      e.preventDefault();
      const location = document.getElementById("location").value;
      const residentName = document.getElementById("residentName").value;
      const detail = document.getElementById("detail").value;
      const injuryLevel = parseInt(document.getElementById("injuryLevel").value);
      const attendedBy = document.getElementById("attendedBy").value;

      await registrarAtencion({
        id: alerta._id,
        location,
        residentName,
        detail,
        intervention: {
          huboIntervencion: true,
          attendedBy,
          attendedAt: new Date(),
          injuryLevel,
        },
      });

      modal.classList.remove("show");
      await cargarAlertas();
    };
  }

  // === REGISTRAR ATENCIÓN ===
  async function registrarAtencion(data) {
    try {
      const res = await fetch(`${backendURL}/api/incidents/registerAttention`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
