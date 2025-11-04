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

  try {
    const res = await fetch(`https://backend-alertas-laborales.onrender.com/api/incidents/listIncidents`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    lista.innerHTML = "";
    if (!data.length) {
      lista.innerHTML = "<p>✅ No hay alertas activas.</p>";
      return;const backendURL = "https://backend-alertas-laborales.onrender.com";

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const lista = document.getElementById("alertas-lista");
  const btnLogout = document.getElementById("btnLogout");
  const userData = JSON.parse(localStorage.getItem("user"));
  const userName = document.getElementById("user-name");
  const btnHistorial = document.getElementById("btnHistorial");

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

  // 📡 Función para cargar alertas
  const cargarAlertas = async (tipo = "listIncidents") => {
    lista.innerHTML = `<div class="loader"></div>`;
    try {
      const res = await fetch(`${backendURL}/api/incidents/${tipo}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      lista.innerHTML = "";
      if (!data.length) {
        lista.innerHTML = `<p class="sin-alertas">✅ No hay alertas ${tipo === "listIncidents" ? "activas" : "en el historial"}.</p>`;
        return;
      }

      data.forEach(alerta => {
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

  // 🕒 Botón para ver historial
  if (btnHistorial) {
    btnHistorial.addEventListener("click", async () => {
      btnHistorial.disabled = true;
      btnHistorial.textContent = "Cargando...";
      await cargarAlertas("historial"); // Cambia a tu endpoint real de historial si difiere
      btnHistorial.textContent = "🕒 Ver Historial Completo";
      btnHistorial.disabled = false;
    });
  }
});

    }

    data.forEach(alerta => {
      const card = document.createElement("div");
      card.className = "alerta-card";
      card.innerHTML = `
        <h3>${alerta.location}</h3>
        <p>${alerta.detail}</p>
        <p><b>Estado:</b> ${alerta.state}</p>
      `;
      lista.appendChild(card);
    });

  } catch (err) {
    console.error("Error al cargar alertas:", err);
    lista.innerHTML = "<p>❌ No se pudieron cargar las alertas.</p>";
  }
});
