const backendURL = "https://backend-alertas-laborales.onrender.com";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const usuario = document.getElementById("usuario").value.trim();
  const contraseña = document.getElementById("password").value.trim();

  try {
    const res = await fetch(`https://backend-alertas-laborales.onrender.com/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, contraseña })
    });

    const data = await res.json();

    if (res.ok && data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify({
        usuario,
        rol: data.rol,
        codigo: data.codigo
        }));
      window.location.href = "alertas.html";
    }
    else {
      alert("❌ Credenciales inválidas");
    }
  } catch (err) {
    alert("⚠️ Error al conectar con el servidor");
    console.error(err);
  }
});
