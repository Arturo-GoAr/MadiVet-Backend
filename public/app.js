
const login = document.getElementById('login');
const registro = document.getElementById('registro');
const perfil = document.getElementById('perfil');
const mensaje = document.getElementById('mensaje');

const formLogin = document.getElementById('formLogin');
const formRegistro = document.getElementById('formRegistro');

const API = '/api';

function mostrarPantalla(pantalla) {
    login.hidden = true;
    registro.hidden = true;
    perfil.hidden = true;

    pantalla.hidden = false;
    mensaje.textContent = '';
}

document.getElementById('irRegistro').addEventListener('click', (e) => {
    e.preventDefault();
    mostrarPantalla(registro);
});

document.getElementById('irLogin').addEventListener('click', (e) => {
    e.preventDefault();
    mostrarPantalla(login);
});

// REGISTRO
formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('registroNombre').value;
    const correo = document.getElementById('registroCorreo').value;
    const password = document.getElementById('registroPassword').value;

    try {
        const respuesta = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nombre, correo, password })
        });

        const datos = await respuesta.json();

        mensaje.textContent = datos.mensaje;

        if (respuesta.ok) {
            formRegistro.reset();
            mostrarPantalla(login);
            mensaje.textContent = 'Cuenta creada. Ahora inicia sesión.';
        }

    } catch (error) {
        mensaje.textContent = 'No se pudo conectar con el servidor';
    }
});

// INICIO DE SESIÓN
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();

    const correo = document.getElementById('loginCorreo').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const respuesta = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ correo, password })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            mensaje.textContent = datos.mensaje;
            return;
        }

        localStorage.setItem('token', datos.token);

        formLogin.reset();

        await cargarPerfil();

    } catch (error) {
        mensaje.textContent = 'No se pudo conectar con el servidor';
    }
});

// CARGAR PERFIL
async function cargarPerfil() {
    const token = localStorage.getItem('token');

    try {
        const respuesta = await fetch(`${API}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            localStorage.removeItem('token');
            mostrarPantalla(login);
            mensaje.textContent = datos.mensaje;
            return;
        }

        document.getElementById('nombreUsuario').textContent =
            `Nombre: ${datos.usuario.nombre}`;

        document.getElementById('correoUsuario').textContent =
            `Correo: ${datos.usuario.correo}`;

        mostrarPantalla(perfil);

    } catch (error) {
        mensaje.textContent = 'Error al cargar el perfil';
    }
}

// CERRAR SESIÓN
document.getElementById('cerrarSesion').addEventListener('click', () => {
    localStorage.removeItem('token');
    mostrarPantalla(login);
    mensaje.textContent = 'Sesión cerrada correctamente';
});

// MOSTRAR U OCULTAR CONTRASEÑAS

document.getElementById('mostrarLogin').addEventListener('change', (e) => {
    document.getElementById('loginPassword').type =
        e.target.checked ? 'text' : 'password';
});

document.getElementById('mostrarRegistro').addEventListener('change', (e) => {
    document.getElementById('registroPassword').type =
        e.target.checked ? 'text' : 'password';
});
