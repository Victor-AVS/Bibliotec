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

function handleAuthProtectedAction(callback) {
    if (isLoggedIn()) {
        if (typeof callback === 'function') callback();
    } else {
        openAuthRequiredModal();
    }
}

function updateUserUI() {
    const guestView = document.getElementById('userGuestView');
    const loggedView = document.getElementById('userLoggedInView');
    const navLabel = document.getElementById('navPerfilLabel');

    if (currentUser) {
        if (guestView) guestView.style.display = 'none';
        if (loggedView) loggedView.style.display = 'block';
        if (navLabel) navLabel.textContent = currentUser.nombre ? currentUser.nombre.split(' ')[0] : 'Usuario';

        const aMaterno = currentUser.a_materno ? ` ${currentUser.a_materno}` : '';
        const fullName = `${currentUser.nombre || ''} ${currentUser.a_paterno || ''}${aMaterno}`.trim();

        const idNombre = document.getElementById('idNombre');
        const idMatricula = document.getElementById('idMatricula');
        const idCorreo = document.getElementById('idCorreo');
        const idCarrera = document.getElementById('idCarrera');
        const idNss = document.getElementById('idNss');
        const idVigencia = document.getElementById('idVigencia');

        if (idNombre) idNombre.textContent = fullName;
        if (idMatricula) idMatricula.textContent = currentUser.matricula || '';
        if (idCorreo) idCorreo.textContent = currentUser.correo || '';
        if (idCarrera && currentUser.carrera) idCarrera.textContent = currentUser.carrera;
        if (idNss && currentUser.nss) idNss.textContent = currentUser.nss;
        if (idVigencia && currentUser.vigencia) idVigencia.textContent = `Vigencia: ${currentUser.vigencia}`;

        const profileImg = document.getElementById('profileAvatarImg');
        const profileDefIcon = document.getElementById('profileDefaultIcon');
        const credImg = document.getElementById('idPhotoImg');
        const credDefIcon = document.getElementById('idPhotoDefaultIcon');

        if (currentUser.foto_url) {
            if (profileImg) { profileImg.src = currentUser.foto_url; profileImg.style.display = 'block'; }
            if (profileDefIcon) profileDefIcon.style.display = 'none';
            if (credImg) { credImg.src = currentUser.foto_url; credImg.style.display = 'block'; }
            if (credDefIcon) credDefIcon.style.display = 'none';
        } else {
            if (profileImg) profileImg.style.display = 'none';
            if (profileDefIcon) profileDefIcon.style.display = 'block';
            if (credImg) credImg.style.display = 'none';
            if (credDefIcon) credDefIcon.style.display = 'block';
        }

        const profileName = document.getElementById('profileName');
        const profileCorreo = document.getElementById('profileCorreo');
        const profileMatricula = document.getElementById('profileMatricula');

        if (profileName) profileName.textContent = fullName;
        if (profileCorreo) profileCorreo.textContent = currentUser.correo || '';
        if (profileMatricula) profileMatricula.textContent = `Matrícula: ${currentUser.matricula || ''}`;

        loadUserWishlist();
    } else {
        if (guestView) guestView.style.display = 'block';
        if (loggedView) loggedView.style.display = 'none';
        if (navLabel) navLabel.textContent = 'Cuenta';
        showAuthView('choice');
    }
}

// PROFILE PHOTO CHANGE HANDLER
function handleProfilePhotoChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!currentUser || !currentUser.id_persona) {
        alert('Debes iniciar sesión para actualizar tu foto de perfil.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result;

        currentUser.foto_url = base64Data;
        localStorage.setItem('bibliotec_user', JSON.stringify(currentUser));
        updateUserUI();

        try {
            const res = await fetch(`${API_BASE_URL}/api/usuario/foto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_persona: currentUser.id_persona,
                    foto_url: base64Data
                })
            });
            const data = await res.json();
            if (data.success) {
                console.log('✅ Foto de perfil actualizada en el servidor.');
            }
        } catch (err) {
            console.error('Error enviando foto al servidor:', err);
        }
    };
    reader.readAsDataURL(file);
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

    if (typeof myBooksData !== 'undefined') {
        if (!myBooksData.deseos) myBooksData.deseos = [];
        const exists = myBooksData.deseos.some(d => d.titulo.toLowerCase() === currentSelectedBook.titulo.toLowerCase());
        if (!exists) {
            myBooksData.deseos.unshift({
                id_libro: currentSelectedBook.id_libro,
                titulo: currentSelectedBook.titulo,
                autor: currentSelectedBook.autor || 'Biblioteca',
                portada: currentSelectedBook.portada_url || '',
                categoria: currentSelectedBook.categoria || 'Biblioteca',
                fecha: new Date().toLocaleDateString('es-MX')
            });
            saveMyBooksData();
        }
    }

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
            alert(`📌 ¡Guardado en tu Lista de Deseos local!\n"${currentSelectedBook.titulo}" ya está en tus pendientes.`);
        }
    } catch (err) {
        console.warn("Servidor no disponible al agregar wishlist, guardado localmente:", err);
        alert(`📌 ¡Guardado en tu Lista de Deseos local!\n"${currentSelectedBook.titulo}" ya está en tus pendientes.`);
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
    if (!isLoggedIn()) {
        openAuthRequiredModal();
        return;
    }

    const modal = document.getElementById('modalCredencial');
    if (!modal) return;

    const nombre = currentUser.nombre ? `${currentUser.nombre} ${currentUser.a_paterno || ''}`.trim() : 'Estudiante TESCHI';
    const matricula = currentUser.matricula || '2026123456';
    const carrera = currentUser.carrera || currentUser.licenciatura || 'Ing. Sistemas Computacionales';
    const turno = currentUser.turno || 'Matutino';

    let vIni = 2026;
    let vFin = 2029;
    if (currentUser.vigencia) {
        const parts = String(currentUser.vigencia).split('-');
        if (parts.length >= 2) {
            vIni = parseInt(parts[0].trim()) || 2026;
            vFin = parseInt(parts[1].trim()) || 2029;
        }
    }
    const vigenciaStr = `${vIni} - ${vFin}`;

    const idNombre = document.getElementById('idNombre');
    const idMatricula = document.getElementById('idMatricula');
    const idCarrera = document.getElementById('idCarrera');
    const idTurno = document.getElementById('idTurno');
    const idVigencia = document.getElementById('idVigencia');
    const idPhotoImg = document.getElementById('idPhotoImg');
    const idPhotoDefaultIcon = document.getElementById('idPhotoDefaultIcon');

    if (idNombre) idNombre.textContent = nombre;
    if (idMatricula) idMatricula.textContent = matricula;
    if (idCarrera) idCarrera.textContent = carrera;
    if (idTurno) idTurno.textContent = turno;
    if (idVigencia) idVigencia.textContent = vigenciaStr;

    if (currentUser.foto_url && String(currentUser.foto_url).trim() !== '') {
        if (idPhotoImg) {
            idPhotoImg.src = currentUser.foto_url;
            idPhotoImg.style.display = 'block';
        }
        if (idPhotoDefaultIcon) idPhotoDefaultIcon.style.display = 'none';
    } else {
        if (idPhotoImg) idPhotoImg.style.display = 'none';
        if (idPhotoDefaultIcon) idPhotoDefaultIcon.style.display = 'block';
    }

    generateMatriculaBarcode(matricula);

    const idAniosPills = document.getElementById('idAniosPills');
    if (idAniosPills) {
        let pillsHtml = '';
        for (let y = vIni; y <= vFin; y++) {
            pillsHtml += `<div class="anio-pill">${y}</div>`;
        }
        idAniosPills.innerHTML = pillsHtml;
    }

    const savedTheme = localStorage.getItem('bibliotec_credencial_theme') || 'predeterminado';
    setCredencialTheme(savedTheme);

    const flipContainer = document.getElementById('credencialFlipContainer');
    if (flipContainer) flipContainer.classList.remove('flipped');

    loadStudentLibraryStatus();

    modal.classList.add('active');
}

let currentCredencialTheme = 'predeterminado';

function setCredencialTheme(themeName) {
    currentCredencialTheme = themeName || 'predeterminado';
    const flipContainer = document.getElementById('credencialFlipContainer');
    if (flipContainer) {
        flipContainer.classList.remove('theme-predeterminado', 'theme-rosa', 'theme-cafe');
        flipContainer.classList.add(`theme-${currentCredencialTheme}`);
    }

    const btnPred = document.getElementById('btnThemePredeterminado');
    const btnRosa = document.getElementById('btnThemeRosa');
    const btnCafe = document.getElementById('btnThemeCafe');

    if (btnPred) btnPred.classList.toggle('active', currentCredencialTheme === 'predeterminado');
    if (btnRosa) btnRosa.classList.toggle('active', currentCredencialTheme === 'rosa');
    if (btnCafe) btnCafe.classList.toggle('active', currentCredencialTheme === 'cafe');

    const mat = (currentUser && currentUser.matricula) ? currentUser.matricula : '2026123456';
    generateMatriculaBarcode(mat);

    try {
        localStorage.setItem('bibliotec_credencial_theme', currentCredencialTheme);
    } catch(e) {}
}

function toggleCredencialFlip() {
    const flipContainer = document.getElementById('credencialFlipContainer');
    if (flipContainer) {
        flipContainer.classList.toggle('flipped');
    }
}

/**
 * Genera y descarga directamente el archivo PDF de la credencial digital (Anverso y Reverso centrados)
 * tanto en dispositivos móviles (Android/Capacitor) como en PC.
 * Nombre del archivo: Credencial_TESCHI_<Matricula>_Biblioteca.pdf
 */
async function downloadCredencialPDF() {
    const printBtn = document.querySelector('.floating-print-btn');
    const originalBtnContent = printBtn ? printBtn.innerHTML : '';
    
    if (printBtn) {
        printBtn.disabled = true;
        printBtn.style.opacity = '0.85';
        printBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Generando PDF...</span>';
    }

    try {
        const nombre = document.getElementById('idNombre')?.innerText || 'Estudiante';
        const matricula = document.getElementById('idMatricula')?.innerText || 'TESCHI';
        const cleanMatricula = String(matricula).replace(/[^a-zA-Z0-9]/g, '');

        const frontOrig = document.querySelector('.credencial-card-face.face-front');
        const backOrig = document.querySelector('.credencial-card-face.face-back');

        if (!frontOrig || !backOrig) {
            alert('No se pudo encontrar la credencial para generar el PDF.');
            return;
        }

        // 1. Clonar anverso y reverso
        const frontClone = frontOrig.cloneNode(true);
        const backClone = backOrig.cloneNode(true);

        // Sincronizar fotografía y código de barras SVG
        const origPhotoImg = document.getElementById('idPhotoImg');
        const clonedPhotoImg = frontClone.querySelector('#idPhotoImg');
        if (origPhotoImg && clonedPhotoImg) {
            clonedPhotoImg.src = origPhotoImg.src;
            clonedPhotoImg.style.display = origPhotoImg.style.display;
        }

        const origPhotoIcon = document.getElementById('idPhotoDefaultIcon');
        const clonedPhotoIcon = frontClone.querySelector('#idPhotoDefaultIcon');
        if (origPhotoIcon && clonedPhotoIcon) {
            clonedPhotoIcon.style.display = origPhotoIcon.style.display;
        }

        const origBarcodeSvg = document.getElementById('svgBarcode');
        const clonedBarcodeSvg = backClone.querySelector('#svgBarcode');
        if (origBarcodeSvg && clonedBarcodeSvg) {
            clonedBarcodeSvg.innerHTML = origBarcodeSvg.innerHTML;
        }

        // Forzar reinicio de transformaciones 3D e visibilidad en los clones
        [frontClone, backClone].forEach(card => {
            card.style.position = 'relative';
            card.style.transform = 'none';
            card.style.webkitTransform = 'none';
            card.style.top = 'auto';
            card.style.left = 'auto';
            card.style.backfaceVisibility = 'visible';
            card.style.webkitBackfaceVisibility = 'visible';
            card.style.opacity = '1';
            card.style.visibility = 'visible';
            card.style.display = 'flex';
            card.style.width = '340px';
            card.style.height = '215px';
            card.style.borderRadius = '14px';
            card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
            card.style.overflow = 'hidden';
            card.style.boxSizing = 'border-box';
            card.style.margin = '0 auto';
        });

        // 2. Crear contenedor A4 independiente en píxeles (evita recortes de pantalla en móviles)
        const exportContainer = document.createElement('div');
        exportContainer.id = 'pdfExportContainer';
        exportContainer.className = `theme-${currentCredencialTheme}`;

        exportContainer.appendChild(frontClone);
        exportContainer.appendChild(backClone);

        document.body.appendChild(exportContainer);

        // Breve espera para asegurar renderizado completo en el DOM
        await new Promise(resolve => setTimeout(resolve, 400));

        const filename = `Credencial_TESCHI_${cleanMatricula || 'Estudiante'}_Biblioteca.pdf`;

        const opt = {
            margin:       0,
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                allowTaint: true,
                logging: false,
                windowWidth: 1000,
                windowHeight: 1300,
                scrollX: 0,
                scrollY: 0,
                x: 0,
                y: 0,
                backgroundColor: '#ffffff'
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (typeof html2pdf !== 'undefined') {
            await html2pdf().set(opt).from(exportContainer).save();
        } else {
            console.warn('html2pdf no está cargado. Usando modo impresión fallback.');
            window.print();
        }

        if (document.body.contains(exportContainer)) {
            document.body.removeChild(exportContainer);
        }
    } catch (err) {
        console.error("Error al descargar el PDF de la credencial:", err);
        alert("Ocurrió un error al descargar el PDF. Por favor, intenta de nuevo.");
    } finally {
        if (printBtn) {
            printBtn.disabled = false;
            printBtn.style.opacity = '1';
            printBtn.innerHTML = originalBtnContent;
        }
    }
}

/* ================= LÓGICA DE ESTADO DEL ESTUDIANTE EN LA BIBLIOTECA (PENDIENTES E HISTORIAL) ================= */
let currentStatusTab = 'pendientes';
let studentStatusData = {
    es_deudor: false,
    pendientes: [],
    historial: [],
    total_historial: 0
};

function switchCredencialTab(tabName) {
    currentStatusTab = tabName;
    const btnPend = document.getElementById('btnTabPendientes');
    const btnHist = document.getElementById('btnTabHistorial');
    const contentPend = document.getElementById('tabContentPendientes');
    const contentHist = document.getElementById('tabContentHistorial');

    if (btnPend) btnPend.classList.toggle('active', tabName === 'pendientes');
    if (btnHist) btnHist.classList.toggle('active', tabName === 'historial');

    if (contentPend) {
        contentPend.style.display = (tabName === 'pendientes') ? 'flex' : 'none';
    }
    if (contentHist) {
        contentHist.style.display = (tabName === 'historial') ? 'flex' : 'none';
    }
}

async function loadStudentLibraryStatus() {
    const idUsuario = (currentUser && currentUser.id_usuario) ? currentUser.id_usuario : 1;
    
    try {
        const response = await fetch(`${backendUrl}/api/usuario/${idUsuario}/prestamos`);
        const data = await response.json();
        if (data.success) {
            studentStatusData = data;
        } else {
            throw new Error(data.mensaje || 'Error al cargar préstamos');
        }
    } catch (e) {
        studentStatusData = {
            es_deudor: false,
            pendientes: [],
            historial: [],
            total_historial: 0
        };
    }

    renderStudentStatusView();
}

function renderStudentStatusView() {
    // 1. Actualizar tarjeta de estatus general
    const headerCard = document.getElementById('credencialStatusHeader');
    const badgeIcon = document.getElementById('statusBadgeIcon');
    const titleEl = document.getElementById('statusTitle');
    const subTitleEl = document.getElementById('statusSubtitle');

    const hasVencidos = (studentStatusData.pendientes || []).some(p => p.es_vencido);
    const isDeudor = studentStatusData.es_deudor || hasVencidos;

    if (headerCard && badgeIcon && titleEl && subTitleEl) {
        if (isDeudor) {
            headerCard.className = 'status-header-card deudor';
            badgeIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            titleEl.textContent = 'Estatus: Deudor de Biblioteca';
            subTitleEl.textContent = 'Tienes libro(s) con fecha de entrega vencida. Por favor entrégalos a la brevedad.';
        } else {
            headerCard.className = 'status-header-card';
            badgeIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            titleEl.textContent = 'Estatus: Estudiante Al Corriente';
            subTitleEl.textContent = 'No registras multas ni entregas pendientes fuera de plazo en Biblioteca TESCHI.';
        }
    }

    // 2. Renderizar pestaña Pendientes
    const contentPend = document.getElementById('tabContentPendientes');
    if (contentPend) {
        if (!studentStatusData.pendientes || studentStatusData.pendientes.length === 0) {
            contentPend.innerHTML = `
                <div class="empty-status-state">
                    <i class="fa-solid fa-circle-check"></i>
                    <p>¡No tienes libros pendientes por entregar!</p>
                    <span>Estás al corriente con todos tus préstamos en la Biblioteca TESCHI.</span>
                </div>
            `;
        } else {
            let html = '';
            studentStatusData.pendientes.forEach(item => {
                const coverHtml = item.portada_url 
                    ? `<img src="${item.portada_url}" class="prestamo-cover" alt="Portada" onerror="this.outerHTML='<div class=\\'prestamo-cover\\'><i class=\\'fa-solid fa-book\\'></i></div>'">`
                    : `<div class="prestamo-cover"><i class="fa-solid fa-book"></i></div>`;
                
                const badgeClass = item.es_vencido ? 'badge-vencido' : 'badge-vigente';
                const badgeText = item.es_vencido ? '<i class="fa-solid fa-circle-exclamation"></i> Vencido / Entregar Hoy' : '<i class="fa-solid fa-clock"></i> En Préstamo Activo';

                html += `
                    <div class="prestamo-card">
                        ${coverHtml}
                        <div class="prestamo-details">
                            <h5 class="prestamo-title" title="${item.titulo}">${item.titulo}</h5>
                            <div class="prestamo-date-legend">
                                <span><i class="fa-solid fa-calendar-minus"></i> Pedido el: ${item.fecha_prestamo}</span>
                            </div>
                            <div class="prestamo-date-legend">
                                <span><i class="fa-solid fa-calendar-check"></i> Entregar el: <strong>${item.fecha_devolucion_esperada}</strong></span>
                            </div>
                            <span class="badge-status ${badgeClass}">${badgeText}</span>
                        </div>
                    </div>
                `;
            });
            contentPend.innerHTML = html;
        }
    }

    // 3. Renderizar pestaña Historial
    const contentHist = document.getElementById('tabContentHistorial');
    if (contentHist) {
        const totalCount = studentStatusData.total_historial || (studentStatusData.historial ? studentStatusData.historial.length : 0);
        let html = `
            <div class="historial-counter-badge">
                <i class="fa-solid fa-book-bookmark"></i> Has pedido prestados <strong>${totalCount} libros</strong> en total
            </div>
        `;

        if (!studentStatusData.historial || studentStatusData.historial.length === 0) {
            html += `
                <div class="empty-status-state">
                    <i class="fa-solid fa-box-open" style="color: #a97862;"></i>
                    <p>Aún no tienes historial de préstamos</p>
                    <span>Tus préstamos concluidos aparecerán en esta sección.</span>
                </div>
            `;
        } else {
            studentStatusData.historial.forEach(item => {
                const coverHtml = item.portada_url 
                    ? `<img src="${item.portada_url}" class="prestamo-cover" alt="Portada" onerror="this.outerHTML='<div class=\\'prestamo-cover\\'><i class=\\'fa-solid fa-book\\'></i></div>'">`
                    : `<div class="prestamo-cover"><i class="fa-solid fa-book"></i></div>`;

                html += `
                    <div class="prestamo-card">
                        ${coverHtml}
                        <div class="prestamo-details">
                            <h5 class="prestamo-title" title="${item.titulo}">${item.titulo}</h5>
                            <div class="prestamo-date-legend">
                                <span><i class="fa-solid fa-calendar-minus"></i> Pedido el: ${item.fecha_prestamo}</span>
                            </div>
                            <div class="prestamo-date-legend">
                                <span><i class="fa-solid fa-calendar-check"></i> Entregado el: <strong>${item.fecha_devolucion_real}</strong></span>
                            </div>
                            <span class="badge-status badge-entregado"><i class="fa-solid fa-circle-check"></i> Concluido</span>
                        </div>
                    </div>
                `;
            });
        }
        contentHist.innerHTML = html;
    }

    switchCredencialTab(currentStatusTab);
}


function generateMatriculaBarcode(matricula) {
    const svg = document.getElementById('svgBarcode');
    const textEl = document.getElementById('idBarcodeText');

    if (textEl) textEl.textContent = matricula;
    if (!svg) return;

    let fillHex = '#1f2937';
    if (currentCredencialTheme === 'rosa') fillHex = '#ff4d4d';
    else if (currentCredencialTheme === 'cafe') fillHex = '#231714';

    const digits = String(matricula).replace(/\D/g, '');
    let barsHtml = `<rect x="0" y="0" width="200" height="60" fill="#ffffff"/>`;
    barsHtml += `<g fill="${fillHex}">`;

    let currentX = 10;
    barsHtml += `<rect x="${currentX}" y="4" width="3" height="46"/>`; currentX += 5;
    barsHtml += `<rect x="${currentX}" y="4" width="2" height="46"/>`; currentX += 4;

    for (let i = 0; i < digits.length; i++) {
        const num = parseInt(digits[i]) || 0;
        const w1 = (num % 3) + 2;
        const gap = (num % 2) + 2;
        const w2 = Math.floor(num / 3) + 2;

        barsHtml += `<rect x="${currentX}" y="4" width="${w1}" height="46"/>`;
        currentX += w1 + gap;
        barsHtml += `<rect x="${currentX}" y="4" width="${w2}" height="46"/>`;
        currentX += w2 + gap;
    }

    barsHtml += `<rect x="${currentX}" y="4" width="3" height="46"/>`; currentX += 5;
    barsHtml += `<rect x="${currentX}" y="4" width="2" height="46"/>`;

    barsHtml += `</g>`;
    svg.innerHTML = barsHtml;
}

function handleFotoCredencialUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert("Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const b64Data = e.target.result;

        const idPhotoImg = document.getElementById('idPhotoImg');
        const idPhotoDefaultIcon = document.getElementById('idPhotoDefaultIcon');

        if (idPhotoImg) {
            idPhotoImg.src = b64Data;
            idPhotoImg.style.display = 'block';
        }
        if (idPhotoDefaultIcon) idPhotoDefaultIcon.style.display = 'none';

        if (currentUser) {
            currentUser.foto_url = b64Data;
            localStorage.setItem('bibliotec_user', JSON.stringify(currentUser));

            if (currentUser.id_persona) {
                const backendUrl = getBackendUrl();
                fetch(`${backendUrl}/api/credencial/upload_foto`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_persona: currentUser.id_persona,
                        foto_b64: b64Data
                    })
                }).then(res => res.json())
                .then(data => {
                    if (data.success) {
                        console.log("Foto guardada en servidor exitosamente.");
                    }
                }).catch(err => console.warn("Sincronización de foto offline:", err));
            }
        }

        alert("¡Fotografía de credencial actualizada exitosamente!");
    };
    reader.readAsDataURL(file);
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

function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
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

// FULLSCREEN INSIGNIAS & GAMIFICATION LOGIC
function openInsigniasModal() {
    const modal = document.getElementById('modalInsignias');
    if (modal) {
        modal.classList.add('active');
        updateInsigniasProgressUI();
    }
}

function updateInsigniasProgressUI() {
    const userPoints = currentUser ? (currentUser.puntos || 0) : 0;
    const userDonations = currentUser ? (currentUser.total_donaciones || 0) : 0;

    // 1. Total Points Display
    const pointsEl = document.getElementById('insigniaTotalPoints');
    if (pointsEl) pointsEl.textContent = `${userPoints} Pts`;

    // 2. User Avatar photo on top right
    const userPhotoImg = document.getElementById('insigniaUserPhoto');
    const defaultAvatarIcon = document.getElementById('insigniaDefaultAvatar');
    if (currentUser && currentUser.foto_url) {
        if (userPhotoImg) { userPhotoImg.src = currentUser.foto_url; userPhotoImg.style.display = 'block'; }
        if (defaultAvatarIcon) defaultAvatarIcon.style.display = 'none';
    } else {
        if (userPhotoImg) userPhotoImg.style.display = 'none';
        if (defaultAvatarIcon) defaultAvatarIcon.style.display = 'block';
    }

    // 3. Segmented Progress Bar Calculation
    let minPts = 0;
    let maxPts = 100;
    let nextBadgeName = 'Lector Bronce';

    if (userPoints >= 600) {
        minPts = 600; maxPts = 600; nextBadgeName = 'Máximo Nivel';
    } else if (userPoints >= 500) {
        minPts = 500; maxPts = 600; nextBadgeName = 'Lector Diamante II';
    } else if (userPoints >= 400) {
        minPts = 400; maxPts = 500; nextBadgeName = 'Lector Diamante I';
    } else if (userPoints >= 250) {
        minPts = 250; maxPts = 400; nextBadgeName = 'Lector Esmeralda';
    } else if (userPoints >= 100) {
        minPts = 100; maxPts = 250; nextBadgeName = 'Lector Oro';
    } else {
        minPts = 0; maxPts = 100; nextBadgeName = 'Lector Bronce';
    }

    let percent = 0;
    if (userPoints >= 600) {
        percent = 100;
    } else {
        const range = maxPts - minPts;
        const currentInSegment = userPoints - minPts;
        percent = Math.min(100, Math.max(0, Math.round((currentInSegment / range) * 100)));
    }

    const ringEl = document.getElementById('insigniaUserPhotoRing');
    if (ringEl) {
        const circumference = 257.61;
        const offset = circumference - (circumference * percent / 100);
        ringEl.style.strokeDashoffset = offset;
    }

    const percentEl = document.getElementById('insigniaProgressPercent');
    if (percentEl) percentEl.textContent = `${percent}%`;

    const labelEl = document.getElementById('insigniaProgressLabel');
    if (labelEl) {
        if (userPoints >= 600) {
            labelEl.textContent = '¡Máximo Nivel!';
        } else {
            labelEl.textContent = `${nextBadgeName}`;
        }
    }

    // 4. Left Side Insignia Display (Obtained Badge or Dashed Silhouette)
    const currentBadgeBox = document.getElementById('insigniaCurrentBadgeBox');
    if (currentBadgeBox) {
        if (userPoints < 100) {
            currentBadgeBox.innerHTML = `
                <div class="insignia-dashed-box">
                    <i class="fa-solid fa-ribbon dashed-icon"></i>
                    <span class="insignia-label-title">Sin insignia obtenida</span>
                </div>
            `;
        } else if (userPoints >= 600) {
            currentBadgeBox.innerHTML = `
                <div class="insignia-obtained-box">
                    <i class="fa-solid fa-crown" style="color: #8b5cf6;"></i>
                    <span class="insignia-label-title">Insignia Diamante II</span>
                </div>
            `;
        } else if (userPoints >= 500) {
            currentBadgeBox.innerHTML = `
                <div class="insignia-obtained-box">
                    <i class="fa-solid fa-gem" style="color: #3b82f6;"></i>
                    <span class="insignia-label-title">Insignia Diamante I</span>
                </div>
            `;
        } else if (userPoints >= 400) {
            currentBadgeBox.innerHTML = `
                <div class="insignia-obtained-box">
                    <i class="fa-solid fa-gem" style="color: #10b981;"></i>
                    <span class="insignia-label-title">Insignia Esmeralda</span>
                </div>
            `;
        } else if (userPoints >= 250) {
            currentBadgeBox.innerHTML = `
                <div class="insignia-obtained-box">
                    <i class="fa-solid fa-award" style="color: #f59e0b;"></i>
                    <span class="insignia-label-title">Insignia Oro</span>
                </div>
            `;
        } else if (userPoints >= 100) {
            currentBadgeBox.innerHTML = `
                <div class="insignia-obtained-box">
                    <i class="fa-solid fa-medal" style="color: #cd7f32;"></i>
                    <span class="insignia-label-title">Insignia Bronce</span>
                </div>
            `;
        }
    }

    // 5. Detailed Badges List States
    setBadgeState('badge-bronce', userPoints >= 100, '100 Pts');
    setBadgeState('badge-oro', userPoints >= 250, '250 Pts');
    setBadgeState('badge-esmeralda', userPoints >= 400, '400 Pts');
    setBadgeState('badge-diamante1', userPoints >= 500, '500 Pts');
    setBadgeState('badge-diamante2', userPoints >= 600, '600 Pts');

    setBadgeState('badge-donante1', userDonations >= 1, '1 Donación');
    setBadgeState('badge-donante2', userDonations >= 3, '3 Donaciones');

    const userEvents = currentUser ? (currentUser.total_eventos || 0) : 0;
    const userLoans = currentUser ? (currentUser.total_prestamos || 0) : 0;
    setBadgeState('badge-evento1', userEvents >= 1, '1 Evento');
    setBadgeState('badge-lector-frecuente', userLoans >= 5, '5 Préstamos');

    const cumplidorLvl = readingGoalData ? (readingGoalData.cumplidorLevel || 0) : 0;
    setBadgeState('badge-cumplidor1', cumplidorLvl >= 1, '1 Meta Cumplida');
}

function getBadgeNameByThreshold(pts) {
    if (pts === 100) return 'Lector Bronce';
    if (pts === 250) return 'Lector Oro';
    if (pts === 400) return 'Lector Esmeralda';
    if (pts === 500) return 'Lector Diamante I';
    if (pts === 600) return 'Lector Diamante II';
    return 'Siguiente Nivel';
}

function setBadgeState(cardId, isUnlocked, reqText) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const tag = card.querySelector('.badge-status-tag');
    if (isUnlocked) {
        card.classList.remove('locked');
        card.classList.add('unlocked');
        if (tag) tag.innerHTML = '<i class="fa-solid fa-circle-check"></i> Desbloqueada';
    } else {
        card.classList.remove('unlocked');
        card.classList.add('locked');
        if (tag) tag.innerHTML = `<i class="fa-solid fa-lock"></i> ${reqText}`;
    }
}

// 6. Insignias Filtering Function ("Filtrar por")
function applyInsigniaFilter(filterType, btn) {
    if (btn) {
        const pills = document.querySelectorAll('.filter-pill');
        pills.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
    }

    const allCards = document.querySelectorAll('.badge-card');
    allCards.forEach(card => {
        if (filterType === 'all') {
            card.style.display = 'flex';
        } else if (filterType === 'obtained') {
            if (card.classList.contains('unlocked')) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        } else if (filterType === 'locked') {
            if (card.classList.contains('locked')) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        }
    });
}

// 7. Pestañas Principales: Insignias vs Metas
function switchGamificationTab(tabName) {
    const btnInsignias = document.getElementById('tabBtnInsignias');
    const btnMetas = document.getElementById('tabBtnMetas');
    const contentInsignias = document.getElementById('tabContentInsignias');
    const contentMetas = document.getElementById('tabContentMetas');

    if (tabName === 'insignias') {
        if (btnInsignias) btnInsignias.classList.add('active');
        if (btnMetas) btnMetas.classList.remove('active');
        if (contentInsignias) contentInsignias.style.display = 'block';
        if (contentMetas) contentMetas.style.display = 'none';
    } else if (tabName === 'metas') {
        if (btnMetas) btnMetas.classList.add('active');
        if (btnInsignias) btnInsignias.classList.remove('active');
        if (contentMetas) contentMetas.style.display = 'block';
        if (contentInsignias) contentInsignias.style.display = 'none';
        updateReadingGoalsUI();
    }
}

// 8. Módulo de Metas de Lectura (Medialuna SVG + Métricas con Bloqueo de 1 Mes)
let readingGoalData = JSON.parse(localStorage.getItem('bibliotec_user_goals')) || {
    period: 'mensual',
    target: 30,
    read: 0,
    startDate: null,
    endDate: null,
    isLocked: false,
    cumplidorLevel: 0
};

function saveReadingGoalData() {
    localStorage.setItem('bibliotec_user_goals', JSON.stringify(readingGoalData));
}

function ensureMonthlyGoalDates() {
    if (!readingGoalData.startDate || !readingGoalData.endDate) {
        const now = new Date();
        readingGoalData.startDate = now.toISOString();
        
        let end = new Date(now);
        end.setMonth(end.getMonth() + 1);
        readingGoalData.endDate = end.toISOString();
        readingGoalData.isLocked = true;
        saveReadingGoalData();
    }
}

function setGoalPeriod(period) {
    readingGoalData.period = period;
    saveReadingGoalData();

    const btnMensual = document.getElementById('btnPeriodMensual');
    const btnAnual = document.getElementById('btnPeriodAnual');

    if (period === 'mensual') {
        if (btnMensual) btnMensual.classList.add('active');
        if (btnAnual) btnAnual.classList.remove('active');
    } else {
        if (btnAnual) btnAnual.classList.add('active');
        if (btnMensual) btnMensual.classList.remove('active');
    }

    updateReadingGoalsUI();
}

function adjustGoalTarget(delta) {
    ensureMonthlyGoalDates();
    if (readingGoalData.isLocked) {
        alert("🔒 La meta mensual está congelada por 1 mes y no se puede modificar durante el reto activo.");
        return;
    }
    readingGoalData.target = Math.max(1, (parseInt(readingGoalData.target) || 30) + delta);
    saveReadingGoalData();
    const inputEl = document.getElementById('inputGoalTarget');
    if (inputEl) inputEl.value = readingGoalData.target;
    updateReadingGoalsUI();
}

function onGoalTargetInputChange() {
    ensureMonthlyGoalDates();
    if (readingGoalData.isLocked) {
        alert("🔒 La meta mensual está congelada por 1 mes y no se puede modificar durante el reto activo.");
        const inputEl = document.getElementById('inputGoalTarget');
        if (inputEl) inputEl.value = readingGoalData.target;
        return;
    }
    const inputEl = document.getElementById('inputGoalTarget');
    if (inputEl) {
        let val = parseInt(inputEl.value) || 1;
        readingGoalData.target = Math.max(1, val);
        saveReadingGoalData();
        updateReadingGoalsUI();
    }
}

function adjustGoalRead(delta) {
    if (delta < 0 && readingGoalData.isLocked) {
        alert("🔒 No puedes restar libros leídos durante un reto activo.");
        return;
    }
    readingGoalData.read = Math.max(0, (parseInt(readingGoalData.read) || 0) + delta);
    saveReadingGoalData();
    updateReadingGoalsUI();
}

function updateReadingGoalsUI() {
    ensureMonthlyGoalDates();

    const now = new Date();
    const endDate = new Date(readingGoalData.endDate);

    // Month Expiration Check!
    if (now >= endDate && readingGoalData.isLocked) {
        const achieved = readingGoalData.read >= readingGoalData.target;
        if (achieved) {
            readingGoalData.cumplidorLevel = (readingGoalData.cumplidorLevel || 0) + 1;
            saveReadingGoalData();
            alert(`🎉 ¡FELICIDADES!\n¡Completaste tu Reto Mensual de Lectura! Leíste ${readingGoalData.read} de ${readingGoalData.target} libros.\nHas obtenido la "Insignia Cumplidor Nivel 1".`);
        } else {
            alert(`⏰ RETO MENSUAL CONCLUIDO\nTranscurrió exactamente 1 mes. Leíste ${readingGoalData.read} de ${readingGoalData.target} libros.\nNo alcanzaste la meta esta vez, el reto se reinicia para tu nuevo intento.`);
        }

        // Reset for new cycle
        readingGoalData.read = 0;
        const newNow = new Date();
        readingGoalData.startDate = newNow.toISOString();
        let newEnd = new Date(newNow);
        newEnd.setMonth(newEnd.getMonth() + 1);
        readingGoalData.endDate = newEnd.toISOString();
        readingGoalData.isLocked = true;
        saveReadingGoalData();
    }

    const target = readingGoalData.target || 30;
    const read = readingGoalData.read || 0;
    const period = readingGoalData.period || 'mensual';

    const percent = Math.min(100, Math.round((read / target) * 100));

    // Lock Display & Banner Updates
    const lockSubtext = document.getElementById('monthlyLockSubtext');
    const lockBadge = document.getElementById('monthlyLockStatusBadge');
    const inputTarget = document.getElementById('inputGoalTarget');

    if (readingGoalData.startDate && readingGoalData.endDate) {
        const startStr = new Date(readingGoalData.startDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        const endStr = new Date(readingGoalData.endDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        if (lockSubtext) lockSubtext.textContent = `Iniciado: ${startStr} — Concluye: ${endStr}`;
    }

    if (readingGoalData.isLocked) {
        if (inputTarget) inputTarget.disabled = true;
        if (lockBadge) lockBadge.innerHTML = '🔒 Meta Fija por 1 Mes';
    } else {
        if (inputTarget) inputTarget.disabled = false;
        if (lockBadge) lockBadge.innerHTML = '🔓 Meta Configurable';
    }

    // Update SVG Half-Circle Arc ("Medialuna")
    const gaugeFill = document.getElementById('readingGoalGaugeFill');
    if (gaugeFill) {
        const circumference = 251.33;
        const offset = circumference - (circumference * percent / 100);
        gaugeFill.style.strokeDashoffset = offset;
    }

    const percentText = document.getElementById('readingGoalPercentText');
    if (percentText) percentText.textContent = `${percent}%`;

    const statusText = document.getElementById('readingGoalStatusText');
    if (statusText) statusText.textContent = `${read} de ${target} libros leídos este ${period}`;

    // Update Controls Display
    if (inputTarget) inputTarget.value = target;

    const displayRead = document.getElementById('displayGoalRead');
    if (displayRead) displayRead.textContent = read;

    const btnMensual = document.getElementById('btnPeriodMensual');
    const btnAnual = document.getElementById('btnPeriodAnual');
    if (btnMensual && btnAnual) {
        if (period === 'mensual') {
            btnMensual.classList.add('active');
            btnAnual.classList.remove('active');
        } else {
            btnAnual.classList.add('active');
            btnMensual.classList.remove('active');
        }
    }

    // Update Metrics Cards
    const metricTarget = document.getElementById('metricGoalTarget');
    if (metricTarget) metricTarget.textContent = target;

    const metricRead = document.getElementById('metricGoalRead');
    if (metricRead) metricRead.textContent = read;

    const metricRemaining = document.getElementById('metricGoalRemaining');
    if (metricRemaining) metricRemaining.textContent = Math.max(0, target - read);

    const metricPace = document.getElementById('metricGoalPace');
    if (metricPace) metricPace.textContent = `${percent}%`;
}

// 9. Pop-up Modal "Registrar Libro Leído" con Verificación en BD (+35 Pts o Puntos Reales)
let currentMatchedBook = null;

function openRegisterBookModal() {
    const inputTitle = document.getElementById('inputReadBookTitle');
    if (inputTitle) inputTitle.value = '';
    currentMatchedBook = null;
    previewReadBookSearch();
    openModal('modalRegistrarLibroLeido');
}

function previewReadBookSearch() {
    const inputTitle = document.getElementById('inputReadBookTitle');
    const query = inputTitle ? inputTitle.value.trim().toLowerCase() : '';
    const titleEl = document.getElementById('previewBookTitle');
    const pointsEl = document.getElementById('previewBookPoints');
    const statusEl = document.getElementById('previewBookStatus');
    const coverBox = document.getElementById('previewCoverBox');

    currentMatchedBook = null;

    if (!query) {
        if (titleEl) titleEl.textContent = 'Libro no especificado';
        if (pointsEl) { pointsEl.textContent = '+35 Pts'; pointsEl.style.background = '#e0e7ff'; pointsEl.style.color = '#3730a3'; }
        if (statusEl) statusEl.textContent = 'Si el libro no existe en la biblioteca, obtienes +35 Pts estándar.';
        if (coverBox) coverBox.innerHTML = '<i class="fa-solid fa-book fallback-grey-book"></i>';
        return;
    }

    // Check in booksMap
    let matched = null;
    if (typeof booksMap !== 'undefined' && booksMap) {
        const keys = Object.keys(booksMap);
        for (let k of keys) {
            const b = booksMap[k];
            if (b && b.titulo && b.titulo.toLowerCase().includes(query)) {
                matched = b;
                break;
            }
        }
    }

    if (matched) {
        currentMatchedBook = matched;
        const pts = matched.puntos || 40;
        const cover = matched.portada_url || (typeof FALLBACK_COVER !== 'undefined' ? FALLBACK_COVER : '');

        if (titleEl) titleEl.textContent = matched.titulo;
        if (pointsEl) { pointsEl.textContent = `+${pts} Pts`; pointsEl.style.background = '#dcfce7'; pointsEl.style.color = '#15803d'; }
        if (statusEl) statusEl.textContent = `¡Encontrado en biblioteca! Otorga +${pts} Pts reales.`;
        if (coverBox) {
            coverBox.innerHTML = `<img src="${cover}" alt="${matched.titulo}">`;
        }
    } else {
        if (titleEl) titleEl.textContent = inputTitle.value.trim();
        if (pointsEl) { pointsEl.textContent = '+35 Pts'; pointsEl.style.background = '#fef3c7'; pointsEl.style.color = '#b45309'; }
        if (statusEl) statusEl.textContent = 'Libro no registrado en BD (Otorga +35 Pts promedio y foto en gris).';
        if (coverBox) coverBox.innerHTML = '<i class="fa-solid fa-book fallback-grey-book"></i>';
    }
}

function confirmRegisterReadBook() {
    const inputTitle = document.getElementById('inputReadBookTitle');
    const bookTitle = inputTitle ? inputTitle.value.trim() : '';
    
    let ptsEarned = 35;
    let titleStr = bookTitle || 'Libro registrado';

    if (currentMatchedBook) {
        ptsEarned = currentMatchedBook.puntos || 40;
        titleStr = currentMatchedBook.titulo;
    }

    // 1. Increment read books count
    readingGoalData.read = (parseInt(readingGoalData.read) || 0) + 1;
    saveReadingGoalData();

    // 2. Add points to current user
    if (!currentUser) currentUser = { puntos: 0 };
    currentUser.puntos = (parseInt(currentUser.puntos) || 0) + ptsEarned;
    localStorage.setItem('bibliotec_user', JSON.stringify(currentUser));

    // 2.5 Add to myBooksData.leidos
    if (typeof myBooksData !== 'undefined') {
        myBooksData.leidos.unshift({
            id: Date.now().toString(),
            titulo: titleStr,
            autor: currentMatchedBook ? (currentMatchedBook.autor || 'Biblioteca') : 'Autor no especificado',
            portada: currentMatchedBook ? (currentMatchedBook.portada_url || '') : '',
            puntos: ptsEarned,
            fecha: new Date().toLocaleDateString('es-MX')
        });
        saveMyBooksData();
    }

    // 3. Update UI
    updateReadingGoalsUI();
    updateInsigniasProgressUI();

    closeModal('modalRegistrarLibroLeido');

    // 4. Alert notification
    alert(`¡Felicidades! Registraste "${titleStr}" exitosamente.\nGanaste +${ptsEarned} Pts para tu nivel e insignias.`);
}

// ==========================================================================
// MÓDULO MIS LIBROS (EN PROCESO, WISHLIST, LEÍDOS)
// ==========================================================================

let myBooksData = JSON.parse(localStorage.getItem('bibliotec_my_books')) || {
    en_proceso: [],
    deseos: [],
    leidos: []
};
if (!myBooksData.deseos) myBooksData.deseos = [];

function saveMyBooksData() {
    localStorage.setItem('bibliotec_my_books', JSON.stringify(myBooksData));
}

function openMisLibrosModal() {
    if (!isLoggedIn()) {
        openAuthRequiredModal();
        return;
    }
    const modal = document.getElementById('modalMisLibros');
    if (modal) modal.classList.add('active');
    
    switchMisLibrosTab('en_proceso');
}

function switchMisLibrosTab(tabName) {
    const btnEnProceso = document.getElementById('btnTabEnProceso');
    const btnDeseos = document.getElementById('btnTabDeseos');
    const btnLeidos = document.getElementById('btnTabLeidos');

    const contentEnProceso = document.getElementById('tabContentMisLibrosEnProceso');
    const contentDeseos = document.getElementById('tabContentMisLibrosDeseos');
    const contentLeidos = document.getElementById('tabContentMisLibrosLeidos');

    if (btnEnProceso) btnEnProceso.classList.remove('active');
    if (btnDeseos) btnDeseos.classList.remove('active');
    if (btnLeidos) btnLeidos.classList.remove('active');

    if (contentEnProceso) contentEnProceso.style.display = 'none';
    if (contentDeseos) contentDeseos.style.display = 'none';
    if (contentLeidos) contentLeidos.style.display = 'none';

    if (tabName === 'en_proceso') {
        if (btnEnProceso) btnEnProceso.classList.add('active');
        if (contentEnProceso) contentEnProceso.style.display = 'block';
        renderMisLibrosEnProceso();
    } else if (tabName === 'deseos') {
        if (btnDeseos) btnDeseos.classList.add('active');
        if (contentDeseos) contentDeseos.style.display = 'block';
        renderMisLibrosDeseos();
    } else if (tabName === 'leidos') {
        if (btnLeidos) btnLeidos.classList.add('active');
        if (contentLeidos) contentLeidos.style.display = 'block';
        renderMisLibrosLeidos();
    }
}

// 1. RENDERIZAR LIBROS EN PROCESO
function renderMisLibrosEnProceso() {
    const container = document.getElementById('containerLibrosEnProceso');
    if (!container) return;

    if (!myBooksData.en_proceso || myBooksData.en_proceso.length === 0) {
        container.innerHTML = `
            <div class="empty-state-box">
                <i class="fa-solid fa-book-open-reader"></i>
                <h5 style="font-weight: 800; font-size: 14px; margin-bottom: 4px;">No estás leyendo ningún libro por ahora</h5>
                <p style="font-size: 12px; margin-bottom: 12px;">Haz clic en el botón de arriba para registrar tu lectura actual.</p>
                <button class="btn-primary btn-sm" onclick="openModalAgregarLibroProceso()"><i class="fa-solid fa-plus"></i> Agregar primer libro</button>
            </div>
        `;
        return;
    }

    let html = '';
    myBooksData.en_proceso.forEach((book, index) => {
        const coverHtml = book.portada ? `<img src="${book.portada}" alt="${book.titulo}">` : `<i class="fa-solid fa-book fallback-icon"></i>`;
        const percent = Math.min(100, Math.max(0, parseInt(book.porcentaje) || 0));

        html += `
            <div class="my-book-card">
                <div class="my-book-cover">
                    ${coverHtml}
                </div>
                <div class="my-book-info">
                    <h5 class="my-book-title">${book.titulo}</h5>
                    <p class="my-book-author"><i class="fa-solid fa-feather"></i> ${book.autor || 'Autor no especificado'}</p>

                    <div class="my-book-progress-box">
                        <div class="my-book-progress-header">
                            <span>Avance de lectura:</span>
                            <span style="color: #9333ea; font-size: 12px;">${percent}%</span>
                        </div>
                        <div class="progress-bar-sm">
                            <div class="progress-fill-sm" style="width: ${percent}%;"></div>
                        </div>
                    </div>

                    <div class="my-book-actions">
                        <button class="btn-secondary btn-sm" onclick="openModalActualizarAvance(${index})" style="font-size: 11px; padding: 4px 10px;">
                            <i class="fa-solid fa-pen"></i> Actualizar Avance
                        </button>
                        <button class="btn-primary btn-sm" onclick="marcarLibroProcesoLeido(${index})" style="font-size: 11px; padding: 4px 10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                            <i class="fa-solid fa-check"></i> Marcar como Leído
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 2. RENDERIZAR LIBROS QUE QUIERO LEER (WISHLIST)
async function renderMisLibrosDeseos() {
    const container = document.getElementById('containerLibrosDeseos');
    if (!container) return;

    if (!myBooksData.deseos) myBooksData.deseos = [];

    // Intento de sincronizar wishlist desde el servidor si hay usuario e IP configurada
    if (currentUser && currentUser.id_usuario) {
        try {
            const backendUrl = getBackendUrl();
            const res = await fetch(`${backendUrl}/api/wishlist/${currentUser.id_usuario}`);
            const data = await res.json();

            if (data.success && data.wishlist && data.wishlist.length > 0) {
                data.wishlist.forEach(srvItem => {
                    const exists = myBooksData.deseos.some(d => 
                        (d.id_libro && d.id_libro == srvItem.id_libro) || 
                        (d.titulo && d.titulo.toLowerCase() === srvItem.titulo.toLowerCase())
                    );
                    if (!exists) {
                        myBooksData.deseos.unshift({
                            id_libro: srvItem.id_libro,
                            titulo: srvItem.titulo,
                            autor: srvItem.autor || 'Biblioteca',
                            portada: srvItem.portada_url || '',
                            categoria: srvItem.categoria || 'Biblioteca',
                            fecha: srvItem.fecha_agregado ? srvItem.fecha_agregado.split('T')[0] : new Date().toLocaleDateString('es-MX')
                        });
                    }
                });
                saveMyBooksData();
            }
        } catch (err) {
            console.warn("Servidor no disponible para cargar wishlist online, mostrando datos locales:", err);
        }
    }

    if (!myBooksData.deseos || myBooksData.deseos.length === 0) {
        container.innerHTML = `
            <div class="empty-state-box">
                <i class="fa-solid fa-heart"></i>
                <h5 style="font-weight: 800; font-size: 14px; margin-bottom: 4px;">Tu Lista de Deseos está vacía</h5>
                <p style="font-size: 12px;">Guarda libros desde el catálogo principal o desde el apartado en proceso seleccionando "Quiero leer".</p>
            </div>
        `;
        return;
    }

    let html = '';
    myBooksData.deseos.forEach((item, index) => {
        const coverHtml = item.portada ? `<img src="${item.portada}" alt="${item.titulo}">` : `<i class="fa-solid fa-book fallback-icon"></i>`;
        const fecha = item.fecha || new Date().toLocaleDateString('es-MX');

        html += `
            <div class="my-book-card">
                <div class="my-book-cover">
                    ${coverHtml}
                </div>
                <div class="my-book-info">
                    <h5 class="my-book-title">${item.titulo}</h5>
                    <p class="my-book-author"><i class="fa-solid fa-layer-group"></i> ${item.categoria || 'Biblioteca'}</p>
                    <span style="font-size: 11px; color: #ec4899; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-bookmark"></i> En Lista de Deseos (${fecha})
                    </span>
                    <div class="my-book-actions" style="margin-top: 6px;">
                        <button class="btn-primary btn-sm" onclick="empezarLecturaDesdeWishlistIndex(${index})" style="font-size: 11px; padding: 4px 10px; background: linear-gradient(135deg, #9333ea 0%, #7e22ce 100%);">
                            <i class="fa-solid fa-play"></i> Empezar a Leer
                        </button>
                        <button class="btn-secondary btn-sm" onclick="eliminarDeWishlist(${index})" style="font-size: 11px; padding: 4px 10px; border-color: #ef4444; color: #ef4444; background: #ffffff;">
                            <i class="fa-solid fa-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// 3. RENDERIZAR LIBROS YA LEÍDOS
function renderMisLibrosLeidos() {
    const container = document.getElementById('containerLibrosLeidos');
    if (!container) return;

    if (!myBooksData.leidos || myBooksData.leidos.length === 0) {
        container.innerHTML = `
            <div class="empty-state-box">
                <i class="fa-solid fa-circle-check"></i>
                <h5 style="font-weight: 800; font-size: 14px; margin-bottom: 4px;">Aún no has registrado libros completados</h5>
                <p style="font-size: 12px; margin-bottom: 12px;">Registra tus lecturas finalizadas para ganar puntos e insignias.</p>
                <button class="btn-primary btn-sm" onclick="openModal('modalRegistrarLibroLeido')"><i class="fa-solid fa-plus"></i> Registrar libro leído</button>
            </div>
        `;
        return;
    }

    let html = '';
    myBooksData.leidos.forEach(book => {
        const coverHtml = book.portada ? `<img src="${book.portada}" alt="${book.titulo}">` : `<i class="fa-solid fa-book fallback-icon"></i>`;
        const pts = book.puntos || 35;
        const fecha = book.fecha || new Date().toLocaleDateString('es-MX');

        html += `
            <div class="my-book-card">
                <div class="my-book-cover">
                    ${coverHtml}
                </div>
                <div class="my-book-info">
                    <h5 class="my-book-title">${book.titulo}</h5>
                    <p class="my-book-author"><i class="fa-solid fa-feather"></i> ${book.autor || 'Autor no especificado'}</p>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                        <span style="display: inline-block; padding: 2px 8px; background: #dcfce7; color: #15803d; border-radius: 10px; font-size: 11px; font-weight: 800;">
                            <i class="fa-solid fa-circle-check"></i> Completado (+${pts} Pts)
                        </span>
                        <span style="font-size: 11px; color: #64748b;">${fecha}</span>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 4. GESTIÓN DE LIBROS EN PROCESO
function openModalActualizarAvance(index) {
    if (index < 0 || !myBooksData.en_proceso[index]) return;
    const b = myBooksData.en_proceso[index];
    const newPercentStr = prompt(`Actualizar porcentaje de lectura para "${b.titulo}" (0 - 100%):`, b.porcentaje || 50);
    if (newPercentStr !== null) {
        const p = Math.min(100, Math.max(0, parseInt(newPercentStr) || 0));
        b.porcentaje = p;
        if (p >= 100) {
            marcarLibroProcesoLeido(index);
        } else {
            saveMyBooksData();
            renderMisLibrosEnProceso();
        }
    }
}

function marcarLibroProcesoLeido(index) {
    if (index < 0 || !myBooksData.en_proceso[index]) return;
    const book = myBooksData.en_proceso[index];

    if (!confirm(`¿Deseas marcar "${book.titulo}" como leído al 100%?`)) return;

    myBooksData.en_proceso.splice(index, 1);
    const pts = 40;

    myBooksData.leidos.unshift({
        id: Date.now().toString(),
        titulo: book.titulo,
        autor: book.autor,
        portada: book.portada,
        puntos: pts,
        fecha: new Date().toLocaleDateString('es-MX')
    });
    saveMyBooksData();

    readingGoalData.read = (parseInt(readingGoalData.read) || 0) + 1;
    saveReadingGoalData();

    if (!currentUser) currentUser = { puntos: 0 };
    currentUser.puntos = (parseInt(currentUser.puntos) || 0) + pts;
    localStorage.setItem('bibliotec_user', JSON.stringify(currentUser));

    updateReadingGoalsUI();
    updateInsigniasProgressUI();

    renderMisLibrosEnProceso();
    alert(`¡Felicidades! Registraste "${book.titulo}" como leído.\nGanaste +${pts} Pts.`);
}

function empezarLecturaDesdeWishlist(titulo, portada) {
    const exists = myBooksData.en_proceso.find(b => b.titulo.toLowerCase() === titulo.toLowerCase());
    if (exists) {
        switchMisLibrosTab('en_proceso');
        alert(`"${titulo}" ya está en tu lista de En proceso.`);
        return;
    }

    myBooksData.en_proceso.unshift({
        id: Date.now().toString(),
        titulo: titulo,
        autor: 'Biblioteca',
        portada: portada || '',
        porcentaje: 10,
        fecha_inicio: new Date().toLocaleDateString('es-MX')
    });
    saveMyBooksData();
    switchMisLibrosTab('en_proceso');
    alert(`¡"${titulo}" fue agregado a tus lecturas en proceso al 10%!`);
}

// 5. MODAL DE SELECCIÓN DE LIBRO Y SINOPSIS EN 2 PASOS
let currentModalCatalogFilterCategory = 'Todos';
let currentSelectedBookForProceso = null;

function openModalAgregarLibroProceso() {
    const inputSearch = document.getElementById('inputModalCatalogSearch');
    if (inputSearch) inputSearch.value = '';
    
    currentModalCatalogFilterCategory = 'Todos';
    currentSelectedBookForProceso = null;

    const containerFilters = document.querySelector('.modal-quick-filters');
    if (containerFilters) {
        const pills = containerFilters.querySelectorAll('.filter-pill');
        pills.forEach(p => {
            if (p.textContent.includes('Todos')) p.classList.add('active');
            else p.classList.remove('active');
        });
    }

    const step1 = document.getElementById('stepModalCatalogList');
    const step2 = document.getElementById('stepModalBookDetail');
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';

    renderModalCatalogGrid();
    openModal('modalAgregarLibroProceso');
}

function filterModalCatalogCategory(category, btnEl) {
    currentModalCatalogFilterCategory = category;
    if (btnEl) {
        const pills = btnEl.parentElement.querySelectorAll('.filter-pill');
        pills.forEach(p => p.classList.remove('active'));
        btnEl.classList.add('active');
    }
    renderModalCatalogGrid();
}

function filterModalCatalogText() {
    renderModalCatalogGrid();
}

function renderModalCatalogGrid() {
    const grid = document.getElementById('modalCatalogGrid');
    if (!grid) return;

    const inputSearch = document.getElementById('inputModalCatalogSearch');
    const query = inputSearch ? inputSearch.value.trim().toLowerCase() : '';

    let booksArray = [];
    if (typeof booksMap !== 'undefined' && booksMap) {
        booksArray = Object.values(booksMap);
    } else if (typeof allBooks !== 'undefined' && allBooks) {
        booksArray = allBooks;
    }

    let filtered = booksArray.filter(b => {
        if (!b) return false;
        const matchesCategory = (currentModalCatalogFilterCategory === 'Todos') || 
            (b.categoria && b.categoria.toLowerCase().includes(currentModalCatalogFilterCategory.toLowerCase()));
        
        const matchesQuery = !query || 
            (b.titulo && b.titulo.toLowerCase().includes(query)) ||
            (b.autor && b.autor.toLowerCase().includes(query));

        return matchesCategory && matchesQuery;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #A97862;">
                <i class="fa-solid fa-book-bookmark" style="font-size: 28px; color: #D77A9B; margin-bottom: 6px;"></i>
                <p style="font-size: 12px; margin: 0;">No se encontraron libros para la búsqueda.</p>
            </div>
        `;
        return;
    }

    let html = '';
    filtered.forEach(book => {
        const cover = book.portada_url ? `<img src="${book.portada_url}" alt="${book.titulo}">` : `<i class="fa-solid fa-book" style="color: #64748b; font-size: 20px;"></i>`;
        const safeTitle = (book.titulo || '').replace(/'/g, "\\'");
        
        html += `
            <div class="modal-catalog-card" onclick="selectBookForProcesoPreview(${book.id_libro})">
                <div class="modal-catalog-cover">
                    ${cover}
                </div>
                <div class="modal-catalog-info">
                    <h5 class="modal-catalog-title">${book.titulo}</h5>
                    <p class="modal-catalog-author">${book.autor || 'Autor no especificado'}</p>
                    <span style="font-size: 10px; font-weight: 700; color: #9333ea; background: #FCEEF3; padding: 2px 6px; border-radius: 8px;">
                        ${book.categoria || 'Biblioteca'}
                    </span>
                </div>
                <i class="fa-solid fa-chevron-right" style="color: #A97862; font-size: 12px;"></i>
            </div>
        `;
    });

    grid.innerHTML = html;
}

function selectBookForProcesoPreview(id_libro) {
    let book = null;
    if (typeof booksMap !== 'undefined' && booksMap[id_libro]) {
        book = booksMap[id_libro];
    } else if (typeof allBooks !== 'undefined' && allBooks) {
        book = allBooks.find(b => b.id_libro == id_libro);
    }

    if (!book) return;
    currentSelectedBookForProceso = book;

    const coverImg = document.getElementById('modalDetailCoverImg');
    const coverFallback = document.getElementById('modalDetailCoverFallback');
    const titleEl = document.getElementById('modalDetailTitle');
    const authorEl = document.getElementById('modalDetailAuthor');
    const categoryTag = document.getElementById('modalDetailCategoryTag');
    const synopsisText = document.getElementById('modalDetailSynopsisText');

    if (book.portada_url) {
        if (coverImg) { coverImg.src = book.portada_url; coverImg.style.display = 'block'; }
        if (coverFallback) coverFallback.style.display = 'none';
    } else {
        if (coverImg) coverImg.style.display = 'none';
        if (coverFallback) coverFallback.style.display = 'block';
    }

    if (titleEl) titleEl.textContent = book.titulo;
    if (authorEl) authorEl.textContent = `Autor: ${book.autor || 'Biblioteca'}`;
    if (categoryTag) categoryTag.textContent = book.categoria || 'Biblioteca';
    if (synopsisText) synopsisText.textContent = book.sinopsis || 'Sin descripción disponible para este título en la biblioteca.';

    const step1 = document.getElementById('stepModalCatalogList');
    const step2 = document.getElementById('stepModalBookDetail');
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';
}

function goBackToModalCatalogSearch() {
    const step1 = document.getElementById('stepModalCatalogList');
    const step2 = document.getElementById('stepModalBookDetail');
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
}

function confirmAddSelectedBookToProceso() {
    if (!currentSelectedBookForProceso) return;

    const book = currentSelectedBookForProceso;
    const inputPercent = document.getElementById('inputDetailPorcentaje');
    const percent = inputPercent ? parseInt(inputPercent.value) || 10 : 10;

    const exists = myBooksData.en_proceso.find(b => b.titulo.toLowerCase() === book.titulo.toLowerCase());
    if (exists) {
        alert(`"${book.titulo}" ya está en tu lista de lecturas en proceso.`);
        closeModal('modalAgregarLibroProceso');
        return;
    }

    myBooksData.en_proceso.unshift({
        id: Date.now().toString(),
        titulo: book.titulo,
        autor: book.autor || 'Biblioteca',
        portada: book.portada_url || '',
        porcentaje: percent,
        fecha_inicio: new Date().toLocaleDateString('es-MX')
    });

    saveMyBooksData();
    closeModal('modalAgregarLibroProceso');
    renderMisLibrosEnProceso();

    alert(`¡Agregaste "${book.titulo}" a tus lecturas en proceso al ${percent}%!`);
}

function confirmAddSelectedBookToWishlist() {
    if (!currentSelectedBookForProceso) return;
    const book = currentSelectedBookForProceso;

    if (!myBooksData.deseos) myBooksData.deseos = [];
    const exists = myBooksData.deseos.some(d => d.titulo.toLowerCase() === book.titulo.toLowerCase());
    if (exists) {
        alert(`"${book.titulo}" ya está en tu Lista de Deseos.`);
        closeModal('modalAgregarLibroProceso');
        return;
    }

    myBooksData.deseos.unshift({
        id_libro: book.id_libro,
        titulo: book.titulo,
        autor: book.autor || 'Biblioteca',
        portada: book.portada_url || '',
        categoria: book.categoria || 'Biblioteca',
        fecha: new Date().toLocaleDateString('es-MX')
    });

    saveMyBooksData();
    closeModal('modalAgregarLibroProceso');

    switchTabMisLibros('deseos');
    alert(`¡Agregaste "${book.titulo}" a tu Lista de Deseos!`);

    if (currentUser && currentUser.id_usuario && book.id_libro) {
        const backendUrl = getBackendUrl();
        fetch(`${backendUrl}/api/wishlist/agregar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_usuario: currentUser.id_usuario,
                id_libro: book.id_libro
            })
        }).catch(err => console.warn("Sync wishlist error:", err));
    }
}

function empezarLecturaDesdeWishlistIndex(index) {
    if (!myBooksData.deseos || !myBooksData.deseos[index]) return;
    const item = myBooksData.deseos[index];

    if (!myBooksData.en_proceso) myBooksData.en_proceso = [];
    myBooksData.en_proceso.unshift({
        id: Date.now().toString(),
        titulo: item.titulo,
        autor: item.autor || 'Biblioteca',
        portada: item.portada || '',
        porcentaje: 10,
        fecha_inicio: new Date().toLocaleDateString('es-MX')
    });

    myBooksData.deseos.splice(index, 1);
    saveMyBooksData();

    switchTabMisLibros('proceso');
    alert(`¡Moviste "${item.titulo}" a lecturas en proceso!`);
}

function eliminarDeWishlist(index) {
    if (!myBooksData.deseos || !myBooksData.deseos[index]) return;
    const item = myBooksData.deseos[index];
    if (confirm(`¿Quitar "${item.titulo}" de tu Lista de Deseos?`)) {
        myBooksData.deseos.splice(index, 1);
        saveMyBooksData();
        renderMisLibrosDeseos();
    }
}



