// ===================================
// API & Data
// ===================================
let coursesData = [];
let episodesData = [];
let featuredCourses = [];
let bannersData = [];
let currentBannerIndex = 0;
let carouselInterval = null;

// Fetch courses from API
async function fetchCourses() {
    try {
        await configReady;
        const response = await fetch(apiUrl('/api/courses'));
        const data = await response.json();

        if (data.success) {
            coursesData = data.courses;
            featuredCourses = data.courses.filter(c => c.featured);
            episodesData = data.courses;
            return data.courses;
        }
    } catch (error) {
        console.error('Error fetching courses:', error);
        return [];
    }
}

// ===================================
// Banner Carousel Logic
// ===================================
async function loadBanners() {
    try {
        await configReady;
        const res = await fetch(apiUrl('/api/banners'));
        const data = await res.json();
        if (data.success && data.banners && data.banners.length > 0) {
            bannersData = data.banners;
            renderCarousel();
        } else {
            console.error('No banners found or error fetching');
            document.getElementById('carouselContainer').innerHTML = '<div class="carousel-loading">No hay banners disponibles</div>';
        }
    } catch (err) {
        console.error('Error loading banners', err);
        document.getElementById('carouselContainer').innerHTML = '<div class="carousel-loading">Error cargando banners</div>';
    }
}

function renderCarousel() {
    const container = document.getElementById('carouselContainer');
    const indicators = document.getElementById('carouselIndicators');
    if (!container || !indicators) return;

    container.innerHTML = '';
    indicators.innerHTML = '';

    bannersData.forEach((banner, index) => {
        // Slide
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.style.backgroundImage = `url('${banner.imageUrl}')`;

        slide.innerHTML = `
            <div class="carousel-overlay">
                <h2 class="carousel-title">${banner.title || ''}</h2>
                <p class="carousel-subtitle">${banner.subtitle || ''}</p>
                ${banner.linkUrl ? `<a href="${banner.linkUrl}" class="carousel-link">Ver más</a>` : ''}
            </div>
        `;
        container.appendChild(slide);

        // Indicator
        const ind = document.createElement('div');
        ind.className = 'carousel-indicator';
        if (index === 0) ind.classList.add('active');
        ind.onclick = () => goToBanner(index);
        indicators.appendChild(ind);
    });

    currentBannerIndex = 0;
    updateCarouselPosition();
    startCarousel();
}

function updateCarouselPosition() {
    const container = document.getElementById('carouselContainer');
    if (!container) return;
    container.style.transform = `translateX(-${currentBannerIndex * 100}%)`;

    // Update indicators
    const indicators = document.querySelectorAll('.carousel-indicator');
    indicators.forEach((ind, idx) => {
        ind.classList.toggle('active', idx === currentBannerIndex);
    });
}

function nextBanner() {
    if (bannersData.length === 0) return;
    currentBannerIndex = (currentBannerIndex + 1) % bannersData.length;
    updateCarouselPosition();
    resetCarouselInterval();
}

function prevBanner() {
    if (bannersData.length === 0) return;
    currentBannerIndex = (currentBannerIndex - 1 + bannersData.length) % bannersData.length;
    updateCarouselPosition();
    resetCarouselInterval();
}

function goToBanner(index) {
    if (index >= 0 && index < bannersData.length) {
        currentBannerIndex = index;
        updateCarouselPosition();
        resetCarouselInterval();
    }
}

function startCarousel() {
    if (carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(nextBanner, 5000); // 5 segundos
}

function resetCarouselInterval() {
    startCarousel();
}

// Make globally available for onclick handlers in HTML
window.nextBanner = nextBanner;
window.prevBanner = prevBanner;

// ===================================
// Settings / Presentation Video Logic
// ===================================

/**
 * Convierte una URL estándar de YouTube o Vimeo a su versión para iframe (embed)
 */
function getEmbedUrl(url) {
    if (!url) return '';

    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('v=')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('embed/')) {
            return url; // Ya es embed
        }

        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`;
        }
    }

    // Vimeo
    if (url.includes('vimeo.com')) {
        const vimeoId = url.split('/').pop().split('?')[0];
        if (vimeoId && !isNaN(vimeoId)) {
            return `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&loop=1`;
        }
    }

    return url;
}
async function loadSettings() {
    try {
        await configReady;
        const res = await fetch(apiUrl('/api/settings'));
        const data = await res.json();

        if (data.success && data.settings) {
            const s = data.settings;
            // Guardar en localStorage para persistencia inmediata al refrescar
            localStorage.setItem('branding_companyName', s.companyName || '');
            localStorage.setItem('branding_logoUrl', s.logoUrl || '');

            // Personalización de Marca (Logo y Nombre)
            if (s.companyName) {
                const logoTexts = document.querySelectorAll('.logo-text, .logo-text-sm');
                logoTexts.forEach(el => el.textContent = s.companyName);
                if (document.title.includes('IATIBET ZUREON')) {
                    document.title = document.title.replace('IATIBET ZUREON', s.companyName);
                }
            }

            if (s.logoUrl) {
                const logoIcons = document.querySelectorAll('.logo-icon, .logo-icon-sm');
                logoIcons.forEach(el => {
                    el.style.backgroundImage = `url('${s.logoUrl}')`;
                    el.style.backgroundSize = 'cover';
                    el.style.backgroundPosition = 'center';
                    el.style.border = 'none'; // Eliminar icono por defecto
                });
            }

            // Eliminar estilos temporales de marca temprana
            const earlyStyle = document.getElementById('early-branding-style');
            if (earlyStyle) earlyStyle.remove();

            // Video de Presentación
            if (s.presentationVideoUrl) {
                const section = document.getElementById('presentationVideoSection');
                const container = document.getElementById('presentationVideoContainer');

                if (section && container) {
                    const videoUrl = getEmbedUrl(s.presentationVideoUrl);

                    container.innerHTML = `<iframe width="100%" height="100%" src="${videoUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>`;
                    section.style.display = 'block';
                }
            }
        }
    } catch (err) {
        console.error('Error loading settings', err);
    }
}

// ===================================
// Create Course Card
// ===================================
function createCourseCard(course) {
    const card = document.createElement('div');
    const courseId = course._id || course.id;
    card.className = 'course-card';

    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const isFav = wishlist.includes(courseId);

    card.innerHTML = `
        <button class="wishlist-btn ${isFav ? 'active' : ''}" onclick="toggleWishlist(event, '${courseId}')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </button>
        <a href="/curso/${courseId}" style="text-decoration:none; color:inherit; display:contents;">
            <div class="course-card-bg" style="background-image: url('${course.thumbnail || '/uploads/default-course.jpg'}')"></div>
            <div class="course-card-overlay"></div>
            <div class="course-card-content">
                <span class="course-badge">${course.category || 'CURSO'}</span>
                <h3 class="course-name">${course.name}</h3>
                <div class="course-stats">
                    <div class="stat-item">
                        <span class="stat-icon"></span>
                        <span>${course.totalChapters || 0} Capítulos</span>
                    </div>
                </div>
                <button class="btn-start">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; margin-right: 0.5rem;"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                    EMPEZAR
                </button>
            </div>
        </a>
    `;

    return card;
}

function toggleWishlist(e, id) {
    e.preventDefault();
    e.stopPropagation();
    let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const idx = wishlist.indexOf(id);
    if (idx > -1) {
        wishlist.splice(idx, 1);
        e.currentTarget.classList.remove('active');
    } else {
        wishlist.push(id);
        e.currentTarget.classList.add('active');
        // Efecto visual divertido
        e.currentTarget.style.transform = 'scale(1.4)';
        setTimeout(() => e.currentTarget.style.transform = '', 200);
    }
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
}

// ===================================
// Render Courses
// ===================================
async function renderCourses() {
    if (coursesData.length === 0) {
        await fetchCourses();
    }

    const coursesGrid = document.getElementById('coursesGrid');
    const popularGrid = document.getElementById('popularGrid');

    if (coursesGrid) {
        coursesGrid.innerHTML = '';
        coursesData.slice(0, 8).forEach(course => {
            coursesGrid.appendChild(createCourseCard(course));
        });
    }

    if (popularGrid) {
        popularGrid.innerHTML = '';
        (featuredCourses.length > 0 ? featuredCourses : coursesData).slice(0, 8).forEach(course => {
            popularGrid.appendChild(createCourseCard(course));
        });
    }
}

// ===================================
// Render Episodes
// ===================================
function renderEpisodes() {
    const episodesGrid = document.getElementById('episodesGrid');

    if (episodesGrid) {
        episodesGrid.innerHTML = '';
        episodesData.forEach(episode => {
            episodesGrid.appendChild(createCourseCard(episode));
        });
    }
}

// ===================================
// Filter Functionality
// ===================================
function setupFilters() {
    const filterSelects = document.querySelectorAll('.filter-select');
    const resetBtn = document.querySelector('.btn-reset');

    filterSelects.forEach(select => {
        select.addEventListener('change', (e) => {
            console.log('Filter changed:', e.target.value);
            // Here you would implement actual filtering logic
            // For now, we'll just re-render the courses
            renderCourses();
        });
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            filterSelects.forEach(select => {
                select.selectedIndex = 0;
            });
            renderCourses();
        });
    }
}

// ===================================
// Mobile Menu Toggle
// ===================================
function setupMobileMenu() {
    const menuBtn = document.querySelector('.menu-btn');
    const nav = document.querySelector('.nav');
    const headerActions = document.querySelector('.header-actions');

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            menuBtn.classList.toggle('active');

            if (nav) nav.classList.toggle('mobile-active');
            if (headerActions) headerActions.classList.toggle('mobile-active');
        });
    }
}

// ===================================
// Search Functionality
// ===================================
function setupSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    const resultsDropdown = document.getElementById('searchResultsDropdown');

    if (searchInput && resultsDropdown) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            if (searchTerm.length < 2) {
                resultsDropdown.classList.remove('active');
                return;
            }

            const filtered = coursesData.filter(c => 
                c.name.toLowerCase().includes(searchTerm) || 
                (c.category && c.category.toLowerCase().includes(searchTerm))
            ).slice(0, 5);

            if (filtered.length > 0) {
                resultsDropdown.innerHTML = filtered.map(c => `
                    <a href="/curso/${c._id || c.id}" class="search-result-item">
                        <div class="search-result-thumb" style="background-image:url('${c.thumbnail || '/uploads/default-course.jpg'}')"></div>
                        <div class="search-result-info">
                            <span class="search-result-name">${c.name}</span>
                            <span class="search-result-category">${c.category || 'Curso'}</span>
                        </div>
                    </a>
                `).join('');
                resultsDropdown.classList.add('active');
            } else {
                resultsDropdown.innerHTML = '<div style="padding:1rem; text-align:center; font-size:0.8rem; color:rgba(255,255,255,0.4);">No se encontraron cursos</div>';
                resultsDropdown.classList.add('active');
            }
        });

        // Cerrar al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsDropdown.contains(e.target)) {
                resultsDropdown.classList.remove('active');
            }
        });

        searchInput.addEventListener('focus', () => {
            if (searchInput.value.length >= 2) resultsDropdown.classList.add('active');
        });
    }
}

// ===================================
// Course Navigation (Prev/Next)
// ===================================
function setupCourseNavigation() {
    const prevBtn = document.querySelector('.btn-prev');
    const nextBtn = document.querySelector('.btn-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            console.log('Previous episode');
            // Implement navigation logic
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            console.log('Next episode');
            // Implement navigation logic
        });
    }
}

// ===================================
// Smooth Scroll
// ===================================
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ===================================
// Intersection Observer for Animations
// ===================================
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe all course cards
    document.querySelectorAll('.course-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
}

// ===================================
// Add CSS for mobile menu states
// ===================================
// Mobile styles moved to static CSS file for better performance
function addMobileStyles() {
    // Styles moved to styles.css
}

// ===================================
// Auth & Header Logic
// ===================================
function updateHeader() {
    const user = JSON.parse(localStorage.getItem('authUser') || 'null');
    const actionsEl = document.getElementById('headerActions');
    if (!actionsEl) return;

    if (user) {
        const initials = user.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
        const hasMem = user.hasMembership;
        actionsEl.innerHTML = `
            <div class="user-badge" id="dropdownBadge">
                <div class="user-avatar">${initials}</div>
                <span class="user-name">${user.name}</span>
                <span class="membership-tag ${hasMem ? 'active' : ''}">${hasMem ? (user.membershipPlan || 'Pro') : 'Sin plan'}</span>
                <div class="user-dropdown" id="dropdownContent">
                    <a href="/" class="dropdown-item">🏠 Inicio</a>
                    <a href="/membresia" class="dropdown-item">💎 Membresía</a>
                    <a href="/perfil" class="dropdown-item">👤 Perfil</a>
                    ${user.role === 'admin' ? '<a href="/admin" class="dropdown-item">⚙️ Admin</a>' : ''}
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-item danger" id="btnLogout">🚪 Cerrar sesión</div>
                </div>
            </div>`;

        // Use timeout to ensure elements are in DOM
        setTimeout(() => {
            const badge = document.getElementById('dropdownBadge');
            const dd = document.getElementById('dropdownContent');
            const logoutBtn = document.getElementById('btnLogout');

            if (badge && dd) {
                badge.onclick = (e) => {
                    e.stopPropagation();
                    const isVisible = dd.style.display === 'block';
                    dd.style.display = isVisible ? 'none' : 'block';
                };
                dd.onclick = (e) => e.stopPropagation();
                document.addEventListener('click', () => {
                    if (dd) dd.style.display = 'none';
                });
            }
            if (logoutBtn) {
                logoutBtn.onclick = logout;
            }
        }, 0);
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    window.location.href = '/login';
}

// ===================================
// Initialize App
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing IATIBET ZUREON Platform...');

    // Auth & Header
    updateHeader();

    // Add mobile styles
    addMobileStyles();

    // Load config/settings (Presentation Video)
    await loadSettings();

    // Load Banner Carousel
    await loadBanners();

    // Render content
    await renderCourses();
    renderEpisodes();

    // Setup interactivity
    setupFilters();
    setupMobileMenu();
    setupSearch();
    setupCourseNavigation();
    setupSmoothScroll();

    // Add scroll animations after a short delay
    setTimeout(() => {
        setupScrollAnimations();
    }, 100);

    console.log('✅ Platform initialized successfully!');
});

// ===================================
// Add some interactive hover effects
// ===================================
// Caché de elementos para evitar querySelectorAll en cada mousemove (alto impacto en rendimiento)
let cachedCards = [];
const updateCachedCards = () => { cachedCards = Array.from(document.querySelectorAll('.course-card')); };

document.addEventListener('mousemove', (e) => {
    // Solo actualizar si la lista está vacía o ha pasado tiempo (aproximación simple)
    if (cachedCards.length === 0) updateCachedCards();
    
    cachedCards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
        } else {
            if (card.style.transform !== '') card.style.transform = '';
        }
    });
});

// Re-cache cuando el DOM cambie (opcional pero recomendado)
const observer = new MutationObserver(updateCachedCards);
if (document.body) observer.observe(document.body, { childList: true, subtree: true });

// Reset card transforms when mouse leaves
document.addEventListener('mouseleave', () => {
    cachedCards.forEach(card => {
        card.style.transform = '';
    });
});
