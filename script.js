/* DATOS DE LOS NIVELES */
const levels = [
    { q: "¿Cuál es el puerto estándar de navegación web encriptada (HTTPS)?", a: "443", h: "Pista (Tutorial): Siempre uso el puerto 443." },
    { q: "¿Qué protocolo traduce nombres de dominio a direcciones IP?", a: "dns", h: "Sus siglas son Domain Name System." },
    { q: "Comando en consola para ver tu dirección IP en Windows.", a: "ipconfig", h: "SISTEMA CORRUPTO: Para 'C' usa la 'G', para 'I' usa la 'K'." },
    { q: "¿Qué ataque satura un servidor con peticiones falsas?", a: "ddos", h: "Distributed Denial of Service." },
    { q: "¿En qué algoritmo se basa el cifrado de redes Wi-Fi WPA2?", a: "aes", h: "Avanzado. Estándar. Seguro (en inglés)." }
];

const area51Parts = [
    "[DOCUMENTO 1/5 - KERNEL] Accesos básicos asegurados. La red central monitorea nodos de actividad inusual.",
    "[DOCUMENTO 2/5 - DEFENSA] Códigos de silos confirmados. Los sistemas de lanzamiento están en 'Standby'.",
    "[DOCUMENTO 3/5 - INTELIGENCIA] Nodos del FBI interceptados. Base de datos de testigos protegidos vulnerada.",
    "[DOCUMENTO 4/5 - ASIA PACÍFICO] Redes de comunicación militar de Corea comprometidas.",
    "[DOCUMENTO 5/5 - INFRAESTRUCTURA] Acceso a cables submarinos logrado. Flujo de datos global a nuestra disposición."
];

let unlockedLevels = 1;
let currentLevel = -1;
let levelsSolved = 0;

let timerInterval;
let tensionTimeout;
let idleMatrixTimeout;
let timeLeft = 0;
let timeExtended = false; // Variable para el salvavidas

const overlay = document.getElementById('quiz-overlay');
const quizBox = document.getElementById('quiz-box');
const hintText = document.getElementById('hint-text');
const tensionHeader = document.getElementById('tension-header');
const feedback = document.getElementById('terminal-feedback');

/* --- SECUENCIA DE ARRANQUE --- */
window.onload = function() {
    startBootSequence();
};

function startBootSequence() {
    const bootLog = document.getElementById('boot-log');
    const sysLines = [
        "INICIALIZANDO OVERLORD_OS v6.0...",
        "Cargando kernel básico... [OK]",
        "Montando sistemas de archivos virtuales... [OK]",
        "Iniciando demonio de cifrado en la sombra...",
        "Comprobando integridad de memoria... 0x0A99F1 completado.",
        "Detectando interfaces de red... eth0 encontrada, wlan0 en modo monitor.",
        "Inyectando scripts de evasión de firewall...",
        "Anulando protocolos de seguridad locales... [EXITO]",
        "Buscando satélites de retransmisión disponibles..."
    ];

    let lineIdx = 0;
    let hexInterval;

    function typeSysLine() {
        if (lineIdx < sysLines.length) {
            bootLog.innerHTML += `> ${sysLines[lineIdx]}<br>`;
            bootLog.scrollTop = bootLog.scrollHeight;
            lineIdx++;
            setTimeout(typeSysLine, 300 + Math.random() * 400);
        } else {
            startHexDump();
        }
    }

    function startHexDump() {
        bootLog.innerHTML += "<br>--- INICIANDO VOLCADO DE MEMORIA ---<br>";
        let hexCount = 0;
        hexInterval = setInterval(() => {
            let randomHex = "";
            for(let i=0; i<8; i++) {
                randomHex += Math.floor(Math.random()*16).toString(16).toUpperCase();
            }
            bootLog.innerHTML += `0x${randomHex}  `;
            bootLog.scrollTop = bootLog.scrollHeight;
            hexCount++;
            if (hexCount > 60) {
                clearInterval(hexInterval);
                bootLog.innerHTML += "<br><br>--- VOLCADO COMPLETADO. MÓDULOS ACTIVOS ---<br><br>";
                startProgressBar();
            }
        }, 30);
    }

    setTimeout(typeSysLine, 500);
}

function startProgressBar() {
    const loaderContainer = document.getElementById('boot-loader-container');
    const bootPct = document.getElementById('boot-pct');
    const loaderBar = document.getElementById('boot-loader-bar');
    const initScreen = document.getElementById('init-boot-screen');

    loaderContainer.style.display = 'block';
    let progress = 0;
    let barLength = 40;

    let progInterval = setInterval(() => {
        progress += Math.floor(Math.random() * 5) + 1;
        if (progress >= 100) progress = 100;

        bootPct.innerText = progress;
        let filled = Math.floor((progress / 100) * barLength);
        let empty = barLength - filled;
        loaderBar.innerText = "#".repeat(filled) + "-".repeat(empty);

        if (progress === 100) {
            clearInterval(progInterval);
            setTimeout(() => {
                initScreen.style.opacity = '0';
                setTimeout(() => {
                    initScreen.style.display = 'none';
                    logTerminal("> SESIÓN INICIADA. ESTABLECIENDO CONEXIÓN SEGURA...");
                    
                    // ESPERA DE 5 SEGUNDOS ANTES DE "ENCONTRAR" EL ARCHIVO
                    setTimeout(() => {
                        logTerminal("> RASTREANDO NODOS VULNERABLES EN EL SERVIDOR...");
                        
                        showLoadingScreen(() => {
                            // 1. Hacemos aparecer el sistema de archivos
                            document.getElementById('file-system').style.display = 'block';
                            logTerminal("> ¡ARCHIVO KERNEL LOCALIZADO! ACCESO DISPONIBLE.");
                            
                            // 2. Iniciamos el primer Quiz automáticamente
                            setTimeout(() => {
                                startLevel(0);
                            }, 1000);
                        }, "Escaneando sectores de memoria");
                        
                    }, 5000); // Los 5 segundos de espera que solicitaste

                }, 1000);
            }, 500);
        }
    }, 80);
}

/* --- LÓGICA DE NIVELES Y PANTALLA DE CARGA --- */
function showLoadingScreen(callback, customText = "Descifrando metadatos") {
    const loader = document.getElementById('loading-screen');
    loader.style.display = 'flex';
    let progress = 0;
    let intv = setInterval(() => {
        progress += Math.floor(Math.random() * 20) + 5;
        if(progress > 100) progress = 100;
        document.getElementById('p-fill').style.width = progress + '%';
        document.getElementById('p-text').innerText = `${customText}: ${progress}%`;
        
        if (progress === 100) {
            clearInterval(intv);
            setTimeout(() => {
                loader.style.display = 'none';
                document.getElementById('p-fill').style.width = '0%';
                callback();
            }, 800);
        }
    }, 300);
}

function activateDistraction() {
    timeLeft = 15; 
    document.getElementById('countdown').style.display = 'block';
    tensionHeader.style.display = 'block';
    tensionHeader.innerText = "¡ALERTA! RASTREO DETECTADO";
    quizBox.classList.add('in-danger');
    
    clearInterval(timerInterval);
    timerInterval = setInterval(tickTimer, 1000);
}

document.addEventListener('mousemove', resetIdleMatrix);
document.addEventListener('keydown', resetIdleMatrix);

function resetIdleMatrix() {
    clearTimeout(idleMatrixTimeout);
    const canvas = document.getElementById('matrix-canvas');
    const box = document.getElementById('quiz-box');
    
    if (overlay.style.display === 'flex') {
        if (currentLevel === 1 || currentLevel === 3) {
            box.classList.remove('fade-out');
            canvas.classList.remove('active-rain');
            overlay.classList.remove('rain-bg');

            idleMatrixTimeout = setTimeout(() => {
                box.classList.add('fade-out');
                canvas.classList.add('active-rain');
                overlay.classList.add('rain-bg');
            }, 5000); 
        } 
        else if (currentLevel === 2) {
            box.classList.remove('fade-out');
            canvas.classList.add('active-rain');
            overlay.classList.add('rain-bg');
        } 
        else {
            box.classList.remove('fade-out');
            canvas.classList.remove('active-rain');
            overlay.classList.remove('rain-bg');
        }
    } else {
        box.classList.remove('fade-out');
        canvas.classList.remove('active-rain');
        overlay.classList.remove('rain-bg');
    }
}

function startLevel(index) {
    let fileEl = document.getElementById('lvl-' + index);

    if(fileEl.classList.contains('solved')) {
        document.getElementById('partial-title').innerText = ">>> ARCHIVO CONFIDENCIAL [PARTE " + (index+1) + "/5]";
        document.getElementById('partial-content').innerText = area51Parts[index];
        document.getElementById('partial-screen').style.display = 'flex';
        return;
    }

    currentLevel = index;
    document.getElementById('quiz-q').innerHTML = `[NIVEL ${index+1}] ` + levels[index].q;
    document.getElementById('quiz-a').value = '';
    feedback.innerText = '';
    hintText.innerText = levels[index].h;
    
    quizBox.className = ''; 
    quizBox.classList.remove('fade-out');
    overlay.classList.remove('rain-bg');
    document.getElementById('matrix-canvas').classList.remove('active-rain');
    document.getElementById('countdown').style.display = 'none';
    tensionHeader.style.display = 'none';
    clearTimeout(tensionTimeout);
    clearInterval(timerInterval);
    clearTimeout(idleMatrixTimeout);

    if (index === 0) {
        hintText.classList.add('show-hint');
    } else if (index >= 1 && index <= 3) {
        hintText.classList.remove('show-hint');
        quizBox.classList.add('hover-hint-enabled');
    } else {
        hintText.classList.remove('show-hint');
    }

    overlay.style.display = 'flex';
    setTimeout(() => document.getElementById('quiz-a').focus(), 100);

    resetIdleMatrix();
    timeExtended = false; // Reiniciamos el salvavidas al empezar un nivel

    // Lógica de Tiempos (Aleatorios)
    if (index >= 1 && index <= 3) {
        // Tiempo aleatorio entre 15 y 45 segundos (15000ms a 45000ms)
        let randomTime = Math.floor(Math.random() * (45000 - 15000 + 1)) + 15000;
        tensionTimeout = setTimeout(activateDistraction, randomTime);
    } else if (index === 4) {
        activateDistraction();
    }
}

function tickTimer() {
    timeLeft--;
    let min = Math.floor(timeLeft / 60);
    let sec = timeLeft % 60;
    document.getElementById('countdown').innerText = `0${min}:${sec < 10 ? '0'+sec : sec}`;

    // SALVAVIDAS (Extender tiempo cuando queda poco)
    if (timeLeft <= 5 && !timeExtended) {
        timeExtended = true; // Evita que se sume tiempo infinitamente
        timeLeft += 20; // Añade 20 segundos de gracia
        
        // Mensaje visual de por qué se sumó tiempo
        feedback.innerText = ">>> ALERTA CRÍTICA: Desvío de proxy activado. Tiempo de rastreo extendido de emergencia.";
        feedback.style.color = "#00ccff"; // Color cyan para que destaque del rojo
    }

    if (timeLeft <= 0) {
        clearInterval(timerInterval);
        feedback.innerText = "TIEMPO AGOTADO. DESCONECTANDO...";
        feedback.style.color = "red";
        setTimeout(() => {
            overlay.style.display = 'none'; 
        }, 2000);
    }
}

document.getElementById('quiz-a').addEventListener('keydown', function(e) {
    if (currentLevel === 2) {
        let char = e.key.toLowerCase();
        if (char === 'g') { e.preventDefault(); this.value += 'c'; }
        else if (char === 'k') { e.preventDefault(); this.value += 'i'; }
        else if (char === 'c') { e.preventDefault(); this.value += 'g'; }
        else if (char === 'i') { e.preventDefault(); this.value += 'k'; }
    }
});

document.getElementById('quiz-a').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') submitAnswer();
});

function submitAnswer() {
    let ans = document.getElementById('quiz-a').value.toLowerCase().trim();
    if (ans === levels[currentLevel].a) {
        clearInterval(timerInterval);
        clearTimeout(tensionTimeout);
        clearTimeout(idleMatrixTimeout);
        overlay.style.display = 'none';
        
        document.getElementById('matrix-canvas').classList.remove('active-rain');
        document.getElementById('quiz-box').classList.remove('fade-out');
        overlay.classList.remove('rain-bg');
        
        let fileEl = document.getElementById('lvl-' + currentLevel);
        fileEl.classList.add('solved');
        logTerminal(`> NODO [${fileEl.innerText}] DESCIFRADO.`);
        
        levelsSolved++;
        
        if (currentLevel + 1 < 5 && (currentLevel + 1) === unlockedLevels) {
            showLoadingScreen(() => {
                document.getElementById('fc-' + (currentLevel + 1)).style.display = 'block';
                unlockedLevels++;
                logTerminal(`> NUEVO ARCHIVO DISPONIBLE EN DIRECTORIO.`);
            });
        }

        if (levelsSolved === 5) {
            document.getElementById('merge-btn').style.display = 'block';
            logTerminal(`> ATENCIÓN: ARCHIVOS LISTOS PARA RECOPILACIÓN.`);
        }
    } else {
        feedback.innerText = "ACCESO DENEGADO: Comando incorrecto.";
        feedback.style.color = "red";
        document.getElementById('quiz-a').value = ''; 
    }
}

function showFinal() {
    document.getElementById('merge-btn').style.display = 'none';
    logTerminal("> RECOPILANDO DATOS... ARCHIVO MAESTRO GENERADO.");
    
    let fs = document.getElementById('file-system');
    let masterContainer = document.createElement('div');
    masterContainer.className = 'file-container';
    masterContainer.style.display = 'block';
    masterContainer.style.marginTop = '15px';

    let masterFolder = document.createElement('div');
    masterFolder.className = 'folder';
    masterFolder.innerText = 'NIVEL_OMEGA';
    
    let masterFile = document.createElement('div');
    masterFile.className = 'file';
    masterFile.style.color = '#ff3333';
    masterFile.innerText = 'EXPEDIENTE_MAESTRO.enc [INFO EXTRA]';
    masterFile.onclick = startFinalSequence; 
    
    masterContainer.appendChild(masterFolder);
    masterContainer.appendChild(masterFile);
    fs.appendChild(masterContainer);
}

function startFinalSequence() {
    document.getElementById('final-screen').style.display = 'flex';
    document.getElementById('matrix-canvas').classList.add('active-rain');
    
    let contentBox = document.getElementById('final-content');
    contentBox.innerText = "";
    
    const fullArea51Content = `==========================================================\n            EXPEDIENTE MAESTRO (NIVEL OMEGA) \n==========================================================\n\n` +
    area51Parts.join("\n\n---\n\n") + 
    `\n\n--- INFO EXTRA CLASIFICADA ---\n> PROTOCOLO ÍCARO ACTIVADO: La recopilación de estos 5 nodos ha desencadenado un rastro directo a tu IP. Las agencias globales están convergiendo a tu ubicación.\n> RECOMENDACIÓN: DESTRUIR EQUIPO INMEDIATAMENTE.\n\n==========================================================`;

    let i = 0;
    let typer = setInterval(() => {
        contentBox.innerText += fullArea51Content[i];
        i++;
        contentBox.scrollTop = contentBox.scrollHeight;
        if (i >= fullArea51Content.length) {
            clearInterval(typer);
            document.getElementById('btn-close-final').style.display = 'block';
        }
    }, 15);
}

function logTerminal(msg) {
    let log = document.getElementById('terminal-log');
    log.innerHTML += `<br>${msg}`;
    log.scrollTop = log.scrollHeight;
}

/* --- DECORACIONES (CANVAS, CLIMA, ETC) --- */
const matrixCvs = document.getElementById('matrix-canvas');
const mCtx = matrixCvs.getContext('2d');
function resizeMatrix() { matrixCvs.width = window.innerWidth; matrixCvs.height = window.innerHeight; }
resizeMatrix(); window.addEventListener('resize', resizeMatrix);

const chars = "10"; const fontSize = 16;
let columns = matrixCvs.width / fontSize;
let drops = [];
for(let x = 0; x < columns; x++) drops[x] = Math.random() * matrixCvs.height;

function drawMatrix() {
    mCtx.fillStyle = "rgba(0, 0, 0, 0.1)"; 
    mCtx.fillRect(0, 0, matrixCvs.width, matrixCvs.height);
    mCtx.fillStyle = "#00FF41"; mCtx.font = fontSize + "px monospace";
    for(let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        mCtx.fillText(text, i * fontSize, drops[i] * fontSize);
        if(drops[i] * fontSize > matrixCvs.height && Math.random() > 0.95) drops[i] = 0;
        drops[i] += 1; 
    }
}
setInterval(drawMatrix, 35); 

function fetchWeather() {
    const select = document.getElementById('country-select').value;
    const output = document.getElementById('weather-output');
    if(!select) return output.innerHTML = `<div class="weather-param"><span>OBJETIVO:</span><span>---</span></div><div class="weather-param"><span>TEMP:</span><span>-- °C</span></div><div class="weather-param"><span>ESTADO:</span><span>DESCONECTADO</span></div>`;
    const [code, city, name] = select.split(',');
    const temp = (Math.random() * 35 - 5).toFixed(1); 
    let status = "ESTABLE", statusColor = "var(--green)";
    if (temp < 0) { status = "ALERTA - HIELO"; statusColor = "#00ccff"; }
    output.innerHTML = `<div class="weather-param"><span>OBJETIVO:</span><span>${city.toUpperCase()}</span></div><div class="weather-param"><span>TEMP:</span><span>${temp} °C</span></div><div class="weather-param"><span>ESTADO:</span><span style="color:${statusColor}; font-weight:bold;">${status}</span></div>`;
}

function encryptText() {
    const input = document.getElementById('crypto-input').value;
    const output = document.getElementById('crypto-output');
    if(!input) return;
    output.innerText = ">>> HASH: " + btoa(input);
}

const globeCvs = document.getElementById('globe-canvas');
const gCtx = globeCvs.getContext('2d');
let globeTimer;
function initGlobe() {
    const container = document.getElementById('globe-container');
    if (!container) return;
    globeCvs.width = container.offsetWidth; globeCvs.height = container.offsetHeight;
    const cx = globeCvs.width / 2, cy = globeCvs.height / 2, radius = Math.min(cx, cy) * 0.8;
    let angle = 0; const dots = [];
    for(let i=0; i<300; i++) {
        const phi = Math.acos(-1 + (2 * i) / 300), theta = Math.sqrt(300 * Math.PI) * phi;
        dots.push({ x: radius * Math.cos(theta) * Math.sin(phi), y: radius * Math.sin(theta) * Math.sin(phi), z: radius * Math.cos(phi) });
    }
    if (globeTimer) clearInterval(globeTimer);
    globeTimer = setInterval(() => {
        gCtx.clearRect(0, 0, globeCvs.width, globeCvs.height); angle += 0.015;
        const userCounter = document.getElementById('active-users');
        if (userCounter) userCounter.innerText = Math.floor(Math.random() * 1000 + 45000);
        dots.forEach(dot => {
            let x = dot.x * Math.cos(angle) - dot.z * Math.sin(angle), z = dot.z * Math.cos(angle) + dot.x * Math.sin(angle);
            let scale = 250 / (250 + z), size = 1.2 * scale;
            gCtx.fillStyle = z > 0 ? '#00FF41' : '#005515';
            gCtx.beginPath(); gCtx.arc(cx + x * scale, cy + dot.y * scale, size, 0, Math.PI*2); gCtx.fill();
        });
    }, 50);
}
initGlobe();
new ResizeObserver(initGlobe).observe(document.getElementById('globe-container'));