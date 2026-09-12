// API BASE URL CONFIGURATION FOR CAPACITOR AND MOBILE WEBVIEW
const getApiBaseUrl = () => {
    if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:' || (window.location.hostname === 'localhost' && window.location.port !== '5000')) {
        const customUrl = localStorage.getItem('bibliotec_server_url');
        if (customUrl) return customUrl.replace(/\/+$/, '');
        return 'https://bibliotec-z6in.onrender.com';
    }
    return '';
};

let API_BASE_URL = getApiBaseUrl();

function initServerIpUI() {
    const input = document.getElementById('serverIpInput');
    if (input) {
        input.value = API_BASE_URL || 'https://bibliotec-z6in.onrender.com';
    }
}

function saveServerUrlSetting() {
    const input = document.getElementById('serverIpInput');
    if (!input) return;

    let val = input.value.trim();
    if (!val) {
        val = 'https://bibliotec-z6in.onrender.com';
    }
    if (!val.startsWith('http://') && !val.startsWith('https://')) {
        val = 'https://' + val;
    }
    val = val.replace(/\/+$/, '');
    localStorage.setItem('bibliotec_server_url', val);
    API_BASE_URL = val;
    alert(`✅ URL del servidor actualizada a: ${val}\nReintentando conexión...`);
    loadStats();
    loadEventos();
    loadLibros();
}

// APP STATE
let currentCategory = 'Todos';
let searchQuery = '';
let eventosList = [];
let booksMap = {};
let currentSelectedBook = null;
let currentCarouselIndex = 0;
let carouselTimer = null;
let currentUser = null; // null = Usuario invitado (no registrado)

let selectedRatingValue = 5;

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    initTheme();
    initUserSession();
    initServerIpUI();
    setupPills();
    setupSearch();
    setupStarPicker();
    loadStats();
    loadEventos();
    loadLibros();
}

// USER SESSION MANAGEMENT
function initUserSession() {
    const savedUser = localStorage.getItem('bibliotec_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateUserUI();
        } catch (e) {
            currentUser = null;
        }
    } else {
        currentUser = null;
        updateUserUI();
    }
}

function isLoggedIn() {
    return currentUser !== null;
}

function updateUserUI() {
    const guestView = document.getElementById('userGuestView');
    const loggedView = document.getElementById('userLoggedInView');
    const navLabel = document.getElementById('navPerfilLabel');

    if (currentUser) {
        if (guestView) guestView.style.display = 'none';
        if (loggedView) loggedView.style.display = 'block';
        if (navLabel) navLabel.textContent = currentUser.nombre.split(' ')[0];

        const aMaterno = currentUser.a_materno ? ` ${currentUser.a_materno}` : '';
        const fullName = `${currentUser.nombre} ${currentUser.a_paterno}${aMaterno}`;

        // Credencial Digital
        document.getElementById('idNombre').textContent = fullName;
        document.getElementById('idMatricula').textContent = currentUser.matricula;
        document.getElementById('idCorreo').textContent = currentUser.correo;
        if (currentUser.carrera && document.getElementById('idCarrera')) {
            document.getElementById('idCarrera').textContent = currentUser.carrera;
        }
        if (currentUser.nss && document.getElementById('idNss')) {
            document.getElementById('idNss').textContent = currentUser.nss;
        }
        if (currentUser.vigencia && document.getElementById('idVigencia')) {
            document.getElementById('idVigencia').textContent = `Vigencia: ${currentUser.vigencia}`;
        }

        // Vista Perfil
        document.getElementById('profileName').textContent = fullName;
        document.getElementById('profileCorreo').textContent = currentUser.correo;
        document.getElementById('profileMatricula').textContent = `Matrícula: ${currentUser.matricula}`;

        loadUserWishlist();
    } else {
        if (guestView) guestView.style.display = 'block';
        if (loggedView) loggedView.style.display = 'none';
        if (navLabel) navLabel.textContent = 'Cuenta';
        showAuthView('choice');
    }
}

function showAuthView(viewName) {
    const choiceView = document.getElementById('authChoiceView');
    const loginView = document.getElementById('authLoginView');
    const registerView = document.getElementById('authRegisterView');

    if (choiceView) choiceView.style.display = 'none';
    if (loginView) loginView.style.display = 'none';
    if (registerView) registerView.style.display = 'none';

    if (viewName === 'login') {
        if (loginView) loginView.style.display = 'block';
    } else if (viewName === 'register') {
        if (registerView) registerView.style.display = 'block';
    } else {
        if (choiceView) choiceView.style.display = 'block';
    }
}

function handleAuthProtectedAction(callback) {
    if (!isLoggedIn()) {
        openAuthRequiredModal();
    } else {
        if (callback) callback();
    }
}

function openAuthRequiredModal() {
    closeModal('modalLogin');
    closeModal('modalRegistro');
    closeModal('modalPerfil');
    document.getElementById('modalAuthRequired').classList.add('active');
}

function openLoginModal() {
    closeModal('modalAuthRequired');
    closeModal('modalRegistro');
    closeModal('modalPerfil');
    document.getElementById('modalLogin').classList.add('active');
}

function openRegisterModal() {
    closeModal('modalAuthRequired');
    closeModal('modalLogin');
    closeModal('modalPerfil');
    document.getElementById('modalRegistro').classList.add('active');
}

// LOGIN SUBMIT
async function handleLogin(event) {
    event.preventDefault();
    const resBox = document.getElementById('loginResultado');
    const correo = document.getElementById('loginCorreo').value.trim();
    const pass = document.getElementById('loginPass').value.trim();

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo: correo, contrasena: pass })
        });
        const data = await res.json();

        resBox.style.display = 'block';
        if (data.success) {
            resBox.style.backgroundColor = '#f0fdf4';
            resBox.style.color = '#166534';
            resBox.textContent = data.mensaje;

            currentUser = data.usuario;
            localStorage.setItem('bibliotec_user', JSON.stringify(currentUser));
            updateUserUI();

            setTimeout(() => {
                closeModal('modalLogin');
            }, 800);
        } else {
            resBox.style.backgroundColor = '#fef2f2';
            resBox.style.color = '#991b1b';
            resBox.textContent = data.mensaje || 'Error al iniciar sesión.';
        }
    } catch (err) {
        resBox.style.display = 'block';
        resBox.style.backgroundColor = '#fef2f2';
        resBox.style.color = '#991b1b';
        resBox.textContent = 'Error de conexión con el servidor.';
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('bibliotec_user');
    updateUserUI();
    closeModal('modalPerfil');
    alert('Has cerrado sesión correctamente.');
}

// THEME / DARK MODE TOGGLE
function initTheme() {
    const savedTheme = localStorage.getItem('bibliotec_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    } else {
        document.body.classList.remove('dark-mode');
        updateThemeIcon(false);
    }
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('bibliotec_theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const iconEl = document.getElementById('themeIcon');
    if (!iconEl) return;

    if (isDark) {
        iconEl.className = 'fa-solid fa-moon icon-mode';
    } else {
        iconEl.className = 'fa-solid fa-sun icon-mode';
    }
}

// SETUP FILTER PILLS
function setupPills() {
    const pills = document.querySelectorAll('.pill-btn');
    pills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentCategory = pill.dataset.category;
            loadLibros();
        });
    });
}

// SETUP SEARCH INPUT
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    let debounceTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            searchQuery = e.target.value.trim();
            loadLibros();
        }, 300);
    });
}

// STAR RATING PICKER LOGIC
function setupStarPicker() {
    const stars = document.querySelectorAll('#starPicker .star-btn');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const val = parseInt(star.dataset.val);
            selectedRatingValue = val;
            updateStarPickerVisual(val);
        });
    });
}

function updateStarPickerVisual(val) {
    const stars = document.querySelectorAll('#starPicker .star-btn');
    stars.forEach(star => {
        const starVal = parseInt(star.dataset.val);
        if (starVal <= val) {
            star.classList.remove('fa-regular');
            star.classList.add('fa-solid', 'active');
        } else {
            star.classList.remove('fa-solid', 'active');
            star.classList.add('fa-regular');
        }
    });
}

// FETCH CON REINTENTO AUTOMÁTICO PARA DESPERTAR EL SERVIDOR EN LA NUBE (RENDER COLD START)
async function fetchWithRetry(url, options = {}, retries = 6, delayMs = 2500) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
        } catch (err) {
            console.log(`[API RETRY ${i + 1}/${retries}] Conectando con servidor en la nube...`);
        }
        if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    return await fetch(url, options);
}

// FETCH STATS
async function loadStats() {
    try {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/stats`);
        const data = await res.json();
        if (data.success) {
            const counterEl = document.getElementById('catalogCounter');
            counterEl.textContent = `${data.total_libros} libros totales en biblioteca`;
        }
    } catch (err) {
        console.error("Error cargando estadísticas:", err);
    }
}

// FETCH CAROUSEL EVENTOS (Cambio automático cada 7 segundos)
async function loadEventos() {
    try {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/eventos`);
        const data = await res.json();
        if (data.success && data.eventos.length > 0) {
            eventosList = data.eventos;
            renderCarousel();
            startCarouselTimer();
        }
    } catch (err) {
        console.error("Error cargando eventos:", err);
    }
}

function renderCarousel() {
    const cardEl = document.getElementById('carouselCard');
    const indicatorsEl = document.getElementById('carouselIndicators');
    if (!eventosList || eventosList.length === 0) return;

    const ev = eventosList[currentCarouselIndex];

    cardEl.style.opacity = 0;
    setTimeout(() => {
        cardEl.innerHTML = `
            <img src="${ev.imagen_url}" alt="Banner" class="carousel-img" onerror="this.onerror=null; this.src='${FALLBACK_COVER}';">
            <div class="carousel-text">
                <span class="carousel-title">${ev.titulo}</span>
                <span class="carousel-desc">${ev.descripcion}</span>
            </div>
        `;
        cardEl.style.opacity = 1;
    }, 200);

    indicatorsEl.innerHTML = eventosList.map((_, idx) => 
        `<div class="dot ${idx === currentCarouselIndex ? 'active' : ''}"></div>`
    ).join('');
}

function startCarouselTimer() {
    if (carouselTimer) clearInterval(carouselTimer);
    carouselTimer = setInterval(() => {
        if (eventosList.length > 0) {
            currentCarouselIndex = (currentCarouselIndex + 1) % eventosList.length;
            renderCarousel();
        }
    }, 7000); // 7 Segundos
}

// FETCH & RENDER BOOKS CATALOG
async function loadLibros() {
    const bookListEl = document.getElementById('bookList');
    bookListEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #6B4035;">
            <i class="fa-solid fa-cloud-arrow-up fa-bounce" style="font-size: 32px; color: #D77A9B; margin-bottom: 12px;"></i>
            <h4 style="font-size: 14px; font-weight: 800; color: #6B4035;">Conectando con la Nube...</h4>
            <p style="margin-top: 4px; font-size: 11px; color: #A97862;">Despertando servidores 24/7 de Bibliotec</p>
        </div>
    `;

    try {
        const url = `${API_BASE_URL}/api/libros?q=${encodeURIComponent(searchQuery)}&categoria=${encodeURIComponent(currentCategory)}`;
        const res = await fetchWithRetry(url);
        const data = await res.json();

        if (data.success) {
            booksMap = {};
            data.libros.forEach(b => { booksMap[b.id_libro] = b; });
            renderBooks(data.libros);
        } else {
            bookListEl.innerHTML = `<p style="text-align:center; color: #ef4444; padding: 20px;">Error al obtener libros.</p>`;
        }
    } catch (err) {
        console.error("Error cargando libros:", err);
        bookListEl.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #991b1b;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; margin-bottom: 8px;"></i>
                <p style="font-size: 13px; font-weight: 700;">No se pudo conectar al servidor en la nube.</p>
                <button class="btn-secondary btn-sm" onclick="loadLibros()" style="margin-top: 12px; font-size: 12px;">
                    <i class="fa-solid fa-rotate-right"></i> Reintentar Conexión
                </button>
            </div>
        `;
    }
}

function renderBooks(libros) {
    const bookListEl = document.getElementById('bookList');
    if (!libros || libros.length === 0) {
        bookListEl.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #94a3b8;">
                <i class="fa-solid fa-book-open" style="font-size: 32px; margin-bottom: 8px;"></i>
                <p style="font-size: 14px; font-weight: 600;">No se encontraron libros para la categoría o búsqueda elegida.</p>
            </div>
        `;
        return;
    }

    bookListEl.innerHTML = libros.map(l => {
        const tagUpper = (l.categoria || 'GENERAL').toUpperCase();
        const calval = parseFloat(l.promedio_calificacion || 0);
        const calificacion = calval.toFixed(2);
        const coverImg = l.portada_url || FALLBACK_COVER;

        const ratingBadgeHTML = calval > 0 
            ? `<span class="badge-tag badge-yellow">⭐ ${calificacion}</span>`
            : `<span class="badge-tag badge-pink">⭐ Sin opiniones</span>`;

        return `
            <div class="book-card" onclick="openBookDetailModal(${l.id_libro})">
                <div class="book-cover-wrapper">
                    <img src="${coverImg}" alt="${l.titulo}" class="book-cover-img" onerror="this.onerror=null; this.src='${FALLBACK_COVER}';">
                    <span class="book-tag-overlay">${l.categoria.split(' ')[0]}</span>
                </div>
                <div class="book-info">
                    <div>
                        <div class="book-meta-top">${tagUpper}</div>
                        <h3 class="book-title">${l.titulo}</h3>
                        <div class="book-author">Por ${l.autor || 'Autor Desconocido'}</div>
                    </div>
                    <div class="book-badges">
                        <span class="badge-tag badge-pink">🌸 ${l.categoria.split('-')[0].trim()}</span>
                        ${ratingBadgeHTML}
                        <span class="badge-tag badge-green">📖 Disponibles: ${l.stock_disponible}/${l.stock_total}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// OPEN BOOK DETAIL MODAL
async function openBookDetailModal(id_libro) {
    const book = booksMap[id_libro];
    if (!book) return;

    currentSelectedBook = book;

    const backdropEl = document.getElementById('detailCoverBackdrop');
    const coverImgEl = document.getElementById('detailCoverImg');

    const coverUrl = book.portada_url || FALLBACK_COVER;
    backdropEl.style.backgroundImage = `url('${coverUrl}')`;
    coverImgEl.src = coverUrl;
    coverImgEl.onerror = () => { 
        coverImgEl.src = FALLBACK_COVER;
        backdropEl.style.backgroundImage = `url('${FALLBACK_COVER}')`;
    };

    document.getElementById('detailTitle').textContent = book.titulo;
    document.getElementById('detailAuthor').textContent = `Por ${book.autor || 'Autor Desconocido'}`;

    const calval = parseFloat(book.promedio_calificacion || 0);
    const ratingHTML = calval > 0 
        ? `<span class="badge-tag badge-yellow">⭐ ${calval.toFixed(2)}</span>`
        : `<span class="badge-tag badge-pink">⭐ Sin opiniones</span>`;

    document.getElementById('detailBadges').innerHTML = `
        <span class="badge-tag badge-pink">🌸 ${book.categoria.split('-')[0].trim()}</span>
        ${ratingHTML}
        <span class="badge-tag badge-green">📖 Stock: ${book.stock_disponible}/${book.stock_total}</span>
    `;

    document.getElementById('detailCategory').textContent = book.categoria;
    document.getElementById('detailEditorial').textContent = book.editorial || 'N/A';
    document.getElementById('detailYear').textContent = book.anio ? `${book.anio} d.C.` : 'N/A';
    document.getElementById('detailISBN').textContent = book.isbn || 'N/A';
    document.getElementById('detailStock').textContent = `${book.stock_disponible} de ${book.stock_total}`;
    document.getElementById('detailPoints').textContent = `+${book.puntos_otorgados || 10} Pts`;

    document.getElementById('detailSynopsis').textContent = book.sinopsis || 'Sin descripción disponible para este título.';

    selectedRatingValue = 5;
    updateStarPickerVisual(5);
    document.getElementById('ratingComment').value = '';
    document.getElementById('ratingResultAlert').style.display = 'none';

    await loadBookComments(id_libro);

    document.getElementById('modalBookDetail').classList.add('active');
}

// FETCH & RENDER COMMENTS (YOUTUBE MOBILE STYLE)
async function loadBookComments(id_libro) {
    const countEl = document.getElementById('ytCommentsCount');
    const listEl = document.getElementById('ytCommentsList');

    try {
        const res = await fetch(`${API_BASE_URL}/api/libros/${id_libro}/resenas`);
        const data = await res.json();

        if (data.success && data.resenas && data.resenas.length > 0) {
            countEl.textContent = `Comentarios (${data.count})`;
            listEl.innerHTML = data.resenas.map(r => {
                const estrellas = '⭐'.repeat(r.calificacion);
                const fecha = new Date(r.fecha_resena).toLocaleDateString();
                const texto = r.comentario ? r.comentario : '<i>(Sin reseña escrita)</i>';
                return `
                    <div class="yt-comment-card">
                        <div class="yt-comment-user">
                            <span>👤 ${r.usuario_nombre} • ${estrellas}</span>
                            <small style="opacity:0.7;">${fecha}</small>
                        </div>
                        <div class="yt-comment-text">${texto}</div>
                    </div>
                `;
            }).join('');
        } else {
            countEl.textContent = `Sin comentarios aún`;
            listEl.innerHTML = `<p style="font-size:12px; color: #a8849b; text-align:center; padding:10px;">Sin comentarios aún. ¡Sé el primero en calificar este libro!</p>`;
        }
    } catch (err) {
        console.error("Error cargando comentarios:", err);
        countEl.textContent = `Sin comentarios aún`;
        listEl.innerHTML = `<p style="font-size:12px; color: #a8849b; text-align:center; padding:10px;">Sin comentarios aún. ¡Sé el primero en calificar este libro!</p>`;
    }
}

function toggleCommentsList() {
    const content = document.getElementById('ytCommentsContent');
    const chevron = document.getElementById('ytChevronIcon');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        chevron.classList.add('rotated');
    } else {
        content.style.display = 'none';
        chevron.classList.remove('rotated');
    }
}

// SUBMIT RATING & COMMENT (VERIFICA AUTENTICACIÓN)
async function submitRating() {
    if (!isLoggedIn()) {
        openAuthRequiredModal();
        return;
    }

    if (!currentSelectedBook) return;
    const resBox = document.getElementById('ratingResultAlert');
    const comment = document.getElementById('ratingComment').value.trim();

    try {
        const res = await fetch(`${API_BASE_URL}/api/libros/${currentSelectedBook.id_libro}/calificar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                calificacion: selectedRatingValue,
                comentario: comment,
                id_usuario: currentUser.id_usuario
            })
        });
        const data = await res.json();

        resBox.style.display = 'block';
        if (data.success) {
            resBox.style.backgroundColor = '#f0fdf4';
            resBox.style.color = '#166534';
            resBox.textContent = data.mensaje;

            currentSelectedBook.promedio_calificacion = data.promedio_calificacion;
            loadLibros();
            
            setTimeout(async () => {
                await loadBookComments(currentSelectedBook.id_libro);
                openBookDetailModal(currentSelectedBook.id_libro);
            }, 500);
        } else {
            resBox.style.backgroundColor = '#fef2f2';
            resBox.style.color = '#991b1b';
            resBox.textContent = data.mensaje || 'Error al enviar calificación.';
        }
    } catch (err) {
        resBox.style.display = 'block';
        resBox.style.backgroundColor = '#fef2f2';
        resBox.style.color = '#991b1b';
        resBox.textContent = 'Error de conexión con el servidor.';
    }
}

// SOLICITAR PRÉSTAMO (VERIFICA AUTENTICACIÓN)
function requestLoan() {
    if (!isLoggedIn()) {
        openAuthRequiredModal();
        return;
    }

    alert(`¡Hola ${currentUser.nombre}! Tu solicitud de préstamo para "${currentSelectedBook.titulo}" ha sido enviada al administrador. Tu folio está en estado PENDIENTE.`);
}

// AGREGAR A LISTA DE DESEOS / QUIERO LEER (VERIFICA AUTENTICACIÓN)
async function addToWishlist() {
    if (!isLoggedIn()) {
        openAuthRequiredModal();
        return;
    }

    if (!currentSelectedBook) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/wishlist/agregar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_usuario: currentUser.id_usuario,
                id_libro: currentSelectedBook.id_libro
            })
        });
        const data = await res.json();

        if (data.success) {
            alert(`📌 ¡Guardado en tu Lista de Deseos!\n"${currentSelectedBook.titulo}" ya está en tus pendientes de lectura.`);
            loadUserWishlist();
        } else {
            alert(data.mensaje || 'Error al agregar a tu lista de deseos.');
        }
    } catch (err) {
        console.error("Error al agregar a wishlist:", err);
        alert('Error de conexión con el servidor.');
    }
}

// CARGAR LISTA DE DESEOS EN PERFIL
async function loadUserWishlist() {
    const container = document.getElementById('wishlistContainer');
    if (!container || !currentUser) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/wishlist/${currentUser.id_usuario}`);
        const data = await res.json();

        if (data.success && data.wishlist && data.wishlist.length > 0) {
            container.innerHTML = data.wishlist.map(item => `
                <div style="display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid rgba(239, 169, 190, 0.3);">
                    <img src="${item.portada_url || FALLBACK_COVER}" style="width: 32px; height: 45px; object-fit: cover; border-radius: 6px;" onerror="this.onerror=null; this.src='${FALLBACK_COVER}';">
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-weight: 700; color: #6B4035; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${item.titulo}</div>
                        <small style="color: #A97862;">${item.categoria}</small>
                    </div>
                    <span style="font-size: 10px; color: #D77A9B; background-color: #FFEBF2; padding: 2px 6px; border-radius: 10px; border: 1px solid #EFA9BE;">Quiero leer</span>
                </div>
            `).join('');
        } else {
            container.innerHTML = `<p style="color: #a8849b; font-style: italic; font-size: 11px;">Aún no has guardado ningún libro en tu lista "Quiero leer".</p>`;
        }
    } catch (err) {
        console.error("Error cargando wishlist:", err);
        container.innerHTML = `<p style="color: #ef4444; font-size: 11px;">Error al cargar tus libros pendientes.</p>`;
    }
}

// MODALS CONTROL
function openCredencialModal() {
    document.getElementById('modalCredencial').classList.add('active');
}

function openInsigniasModal() {
    document.getElementById('modalInsignias').classList.add('active');
}

function openPerfilModal() {
    if (!isLoggedIn()) {
        openAuthRequiredModal();
        return;
    }
    loadUserWishlist();
    document.getElementById('modalPerfil').classList.add('active');
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
}

// ROLE SELECTION IN REGISTRATION FORM
let currentRegistrationRole = 'usuario';

function selectRegistrationRole(role) {
    const btnAlumno = document.getElementById('btnRoleAlumno');
    const btnAdmin = document.getElementById('btnRoleAdmin');
    const lblMatricula = document.getElementById('lblMatricula');
    const inputMatricula = document.getElementById('regMatricula');

    if (role === 'admin') {
        currentRegistrationRole = 'administrador';
        if (btnAlumno) btnAlumno.classList.remove('active');
        if (btnAdmin) btnAdmin.classList.add('active');
        if (lblMatricula) lblMatricula.textContent = 'Clave de Trabajador:';
        if (inputMatricula) inputMatricula.placeholder = 'EMP-202645';
    } else {
        currentRegistrationRole = 'usuario';
        if (btnAdmin) btnAdmin.classList.remove('active');
        if (btnAlumno) btnAlumno.classList.add('active');
        if (lblMatricula) lblMatricula.textContent = 'Matrícula:';
        if (inputMatricula) inputMatricula.placeholder = '2023452074';
    }
}

function closeRegisterSuccessModal() {
    closeModal('modalRegistroExito');
    closeModal('modalRegistro');
}

// REGISTRO FORM SUBMIT
async function handleRegistro(event) {
    event.preventDefault();
    const resBox = document.getElementById('registroResultado');
    const form = document.getElementById('formRegistro');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
    }

    const carreraEl = document.getElementById('regCarrera');
    const nssEl = document.getElementById('regNss');
    const body = {
        nombre: document.getElementById('regNombre').value.trim(),
        a_paterno: document.getElementById('regPaterno').value.trim(),
        a_materno: document.getElementById('regMaterno') ? document.getElementById('regMaterno').value.trim() : '',
        carrera: carreraEl ? carreraEl.value : 'Ing. Sistemas Computacionales',
        nss: nssEl ? nssEl.value.trim() : '',
        correo: document.getElementById('regCorreo').value.trim(),
        correo_respaldo: document.getElementById('regRespaldo').value.trim(),
        matricula: document.getElementById('regMatricula').value.trim(),
        telefono: document.getElementById('regTelefono').value.trim(),
        contrasena: document.getElementById('regPass').value.trim(),
        rol: currentRegistrationRole
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (data.success) {
            resBox.style.display = 'none';

            currentUser = data.usuario;
            localStorage.setItem('bibliotec_user', JSON.stringify(currentUser));
            updateUserUI();

            closeModal('modalRegistro');
            document.getElementById('modalRegistroExito').classList.add('active');

            if (form) form.reset();
        } else {
            const errMsg = data.mensaje || data.error || 'La matrícula o correo ya están registrados con anterioridad.';
            resBox.style.display = 'block';
            resBox.style.backgroundColor = '#fef2f2';
            resBox.style.color = '#991b1b';
            resBox.textContent = errMsg;

            const errModalMsg = document.getElementById('regErrorMessage');
            if (errModalMsg) errModalMsg.textContent = errMsg;
            const errModal = document.getElementById('modalRegistroError');
            if (errModal) errModal.classList.add('active');
        }
    } catch (err) {
        const errMsg = 'Error de conexión con el servidor.';
        resBox.style.display = 'block';
        resBox.style.backgroundColor = '#fef2f2';
        resBox.style.color = '#991b1b';
        resBox.textContent = errMsg;

        const errModalMsg = document.getElementById('regErrorMessage');
        if (errModalMsg) errModalMsg.textContent = errMsg;
        const errModal = document.getElementById('modalRegistroError');
        if (errModal) errModal.classList.add('active');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Registrarme Ahora';
        }
    }
}
