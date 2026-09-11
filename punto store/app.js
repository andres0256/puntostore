const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const PUERTO = 3000;
const CLAVE_SECRETA = "MiClaveSuperSeguraWOPI123";

// Base de datos temporal en memoria
const comprasRealizadas = new Set();

// Crear carpeta de archivos y un archivo de prueba si no existen
const carpetaArchivos = path.join(__dirname, 'archivos');
if (!fs.existsSync(carpetaArchivos)) {
    fs.mkdirSync(carpetaArchivos);
}
const rutaDocPrueba = path.join(carpetaArchivos, 'ejemplo.docx');
if (!fs.existsSync(rutaDocPrueba)) {
    fs.writeFileSync(rutaDocPrueba, 'Contenido de prueba para WOPI');
}

// --------------------------------------------------------------------------
// 1. RUTA PRINCIPAL: Muestra la tienda y el carrito (HTML + CSS + JS)
// --------------------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Carrito RZ Store</title>
    <style>
        :root {
            --negro-fondo: #0a050d;
            --blanco: #ffffff;
            --rojo-vaciar: #dc3545;
            --verde-comprar: #25d366;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', sans-serif; }
        body { background-color: var(--negro-fondo); color: var(--blanco); padding: 40px 20px; }
        .contenedor { max-width: 600px; margin: 0 auto; background: #2b2b2b; padding: 25px; border-radius: 12px; }
        h1 { margin-bottom: 20px; text-align: center; }
        .item-carrito { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid #444; }
        .total { font-size: 1.2em; font-weight: bold; margin-top: 20px; text-align: right; }
        .acciones { display: flex; gap: 10px; margin-top: 25px; }
        .btn { flex: 1; padding: 12px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; text-align: center; color: white; }
        .btn-comprar { background: var(--verde-comprar); color: black; }
        .btn-vaciar { background: var(--rojo-vaciar); }
    </style>
</head>
<body>

<div class="contenedor">
    <h1>Tu Carrito🛒</h1>
    <div id="lista-productos"></div>
    <div class="total" id="precio-total">Total: $0</div>
    <div class="acciones">
        <button onclick="limpiarCarrito()" class="btn btn-vaciar">Vaciar Carrito</button>
        <button onclick="comprarYProcesarWopi()" class="btn btn-comprar">Comprar y Abrir WOPI →</button>
    </div>
</div>

<script>
    // Inicializar producto en el carrito
    if (!localStorage.getItem('miCarrito')) {
        localStorage.setItem('miCarrito', JSON.stringify([
            { id: "doc_101", nombre: "Plantilla Contable Premium .docx", precio: 15000, cantidad: 1 }
        ]));
    }

    function mostrarCarrito() {
        let carrito = JSON.parse(localStorage.getItem('miCarrito')) || [];
        let contenedor = document.getElementById('lista-productos');
        let totalElemento = document.getElementById('precio-total');
        
        contenedor.innerHTML = "";
        let suma = 0;

        if (carrito.length === 0) {
            contenedor.innerHTML = "<p style='text-align:center;'>Carrito vacío</p>";
            totalElemento.innerText = "Total: $0";
            return;
        }

        carrito.forEach(item => {
            suma += item.precio * item.cantidad;
            contenedor.innerHTML += \`
                <div class="item-carrito">
                    <div>
                        <strong>\${item.nombre}</strong><br>
                        <small>Cantidad: \${item.cantidad}</small>
                    </div>
                    <span>$\${item.precio}</span>
                </div>
            \`;
        });
        
        totalElemento.innerText = "Total: $" + suma;
    }

    function limpiarCarrito() {
        localStorage.removeItem('miCarrito');
        mostrarCarrito();
    }

    async function comprarYProcesarWopi() {
        let carrito = JSON.parse(localStorage.getItem('miCarrito')) || [];
        if (carrito.length === 0) return alert('El carrito está vacío');

        try {
            // Petición al servidor para autorizar el acceso
            const res = await fetch('/api/comprar-documento', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuarioId: "user_789", productoId: carrito[0].id })
            });

            const data = await res.json();

            if (data.exito) {
                // Redirigir al visor
                window.location.href = '/visor?wopiSrc=' + encodeURIComponent(data.wopiSrc) + '&accessToken=' + encodeURIComponent(data.accessToken);
            } else {
                alert("Error al procesar la compra");
            }
        } catch (err) {
            alert("Error conectando con el servidor");
        }
    }

    mostrarCarrito();
</script>
</body>
</html>
    `);
});

// --------------------------------------------------------------------------
// 2. RUTA DEL VISOR WOPI
// --------------------------------------------------------------------------
app.get('/visor', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Visor WOPI</title>
    <style>html, body { margin:0; padding:0; height:100%; overflow:hidden; background:#1a1a1a; }</style>
</head>
<body>
<div id="frame-container"></div>
<script>
    const params = new URLSearchParams(window.location.search);
    const wopiSrc = params.get('wopiSrc');
    const accessToken = params.get('accessToken');

    if (wopiSrc && accessToken) {
        // Dominio del visor WOPI de Office/Collabora
        const CLIENTE_OFFICE_URL = "https://officewebapps.tu-dominio.com/wv/wordviewerframe.aspx";
        
        const iframe = document.createElement('iframe');
        iframe.src = \`\${CLIENTE_OFFICE_URL}?WOPISrc=\${encodeURIComponent(wopiSrc)}&access_token=\${encodeURIComponent(accessToken)}\`;
        iframe.style.width = '100%';
        iframe.style.height = '100vh';
        iframe.style.border = 'none';
        document.getElementById('frame-container').appendChild(iframe);
    } else {
        document.body.innerHTML = "<h2 style='color:white;text-align:center;'>Faltan parámetros de acceso.</h2>";
    }
</script>
</body>
</html>
    `);
});

// --------------------------------------------------------------------------
// 3. API Y ENDPOINTS PROTOCOLO WOPI
// --------------------------------------------------------------------------
app.post('/api/comprar-documento', (req, res) => {
    const { usuarioId, productoId } = req.body;
    
    // Guardar que el usuario pagó
    comprasRealizadas.add(`${usuarioId}_${productoId}`);

    // Token con vigencia de 2 horas
    const accessToken = jwt.sign({ usuarioId, productoId }, CLAVE_SECRETA, { expiresIn: '2h' });
    const wopiSrc = `http://localhost:${PUERTO}/wopi/files/${productoId}`;

    res.json({ exito: true, accessToken, wopiSrc });
});

// Endpoint WOPI: CheckFileInfo
app.get('/wopi/files/:fileId', (req, res) => {
    const token = req.query.access_token;
    try {
        const decodificado = jwt.verify(token, CLAVE_SECRETA);
        if (!comprasRealizadas.has(`${decodificado.usuarioId}_${decodificado.productoId}`)) {
            return res.status(401).send('Acceso no pagado');
        }

        res.json({
            BaseFileName: "ejemplo.docx",
            OwnerId: "rz_store",
            Size: 1024,
            UserId: decodificado.usuarioId,
            UserCanWrite: true
        });
    } catch (err) {
        res.status(401).send('Token no válido');
    }
});

// Endpoint WOPI: GetFile
app.get('/wopi/files/:fileId/contents', (req, res) => {
    const token = req.query.access_token;
    try {
        jwt.verify(token, CLAVE_SECRETA);
        res.sendFile(rutaDocPrueba);
    } catch (err) {
        res.status(401).send('No autorizado');
    }
});

// Iniciar servidor
app.listen(PUERTO, () => {
    console.log(`====================================================`);
    console.log(`Servidor WOPI todo-en-uno corriendo con éxito.`);
    console.log(`Abre tu navegador e ingresa a: http://localhost:${PUERTO}`);
    console.log(`====================================================`);
});