// ===================================
// API & Data
// ===================================
let coursesData = [];
let episodesData = [];
let featuredCourses = [];

// Fetch courses from API
async function fetchCourses() {
    try {
        const response = await fetch('/api/courses');
        const data = await response.json();
        
        if (data.success) {
            coursesData = data.courses;
            featuredCourses = data.courses.filter(c => c.featured);
            episodesData = data.courses; // Use same courses as episodes for now
            return data.courses;
        }
    } catch (error) {
        console.error('Error fetching courses:', error);
        return [];
    }
}

// ===================================
// Create Course Card
// ===================================
function createCourseCard(course) {
    const card = document.createElement('a');
    card.href = `/curso/${course.id}`;
    card.className = 'course-card';
    
    card.innerHTML = `
        <div class="course-thumbnail">
            <img src="${course.thumbnail || '/uploads/default-course.jpg'}" alt="${course.name}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0;" onerror="this.src='/uploads/default-course.jpg'">
            <button class="play-button">
                <svg width="68" height="48" viewBox="0 0 68 48">
                    <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#FF0000"/>
                    <path d="M 45,24 27,14 27,34" fill="#FFFFFF"/>
                </svg>
            </button>
        </div>
        <div class="course-body">
            <span class="course-badge">${course.category}</span>
            <h3 class="course-name">${course.name}</h3>
            <div class="course-stats">
                <div class="stat-item">
                    <div class="stat-icon">●</div>
                    <span>${course.chapters} Capítulos</span>
                </div>
                <div class="stat-item">
                    <span>${course.episodes} Capítulos</span>
                </div>
            </div>
            <button class="btn-start">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="display: inline-block; margin-right: 0.5rem;">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2"/>
                    <path d="M6 5L11 8L6 11V5Z" fill="currentColor"/>
                </svg>
                EMPEZAR
            </button>
        </div>
    `;
    
    return card;
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
    const searchInput = document.querySelector('.search-input');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            console.log('Searching for:', searchTerm);
            
            // Here you would implement actual search logic
            // For demo purposes, we'll just filter the displayed courses
            if (searchTerm.length > 0) {
                const filteredCourses = coursesData.filter(course => 
                    course.name.toLowerCase().includes(searchTerm) ||
                    course.category.toLowerCase().includes(searchTerm)
                );
                
                const coursesGrid = document.getElementById('coursesGrid');
                if (coursesGrid) {
                    coursesGrid.innerHTML = '';
                    filteredCourses.forEach(course => {
                        coursesGrid.appendChild(createCourseCard(course));
                    });
                }
            } else {
                renderCourses();
            }
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
function addMobileStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 768px) {
            .nav.mobile-active,
            .header-actions.mobile-active {
                display: flex;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: rgba(26, 10, 46, 0.98);
                backdrop-filter: blur(10px);
                flex-direction: column;
                padding: 1rem;
                gap: 1rem;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }
            
            .menu-btn.active span:nth-child(1) {
                transform: rotate(45deg) translate(5px, 5px);
            }
            
            .menu-btn.active span:nth-child(2) {
                opacity: 0;
            }
            
            .menu-btn.active span:nth-child(3) {
                transform: rotate(-45deg) translate(7px, -7px);
            }
        }
    `;
    document.head.appendChild(style);
}

// ===================================
// Initialize App
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing IATIBET ZUREON Platform...');
    
    // Add mobile styles
    addMobileStyles();
    
    // Render content
    renderCourses();
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
document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.course-card');
    cards.forEach(card => {
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
            card.style.transform = '';
        }
    });
});

// Reset card transforms when mouse leaves
document.addEventListener('mouseleave', () => {
    const cards = document.querySelectorAll('.course-card');
    cards.forEach(card => {
        card.style.transform = '';
    });
});
