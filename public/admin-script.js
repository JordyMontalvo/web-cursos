// ===================================
// Admin Panel JavaScript - v2.2 (Categorías Dinámicas)
// ===================================

let allCourses = [];
let lastFetchTime = 0;
const CACHE_DURATION = 30000;
let editingCourseId = null;
let currentContentCourseId = null;
let categoriesData = [];
let editingCategoryId = null;
let activeTab = 'courses';

// ===================================
// API Functions
// ===================================

async function fetchCourses(force = false) {
    const now = Date.now();
    if (!force && allCourses.length > 0 && (now - lastFetchTime < CACHE_DURATION)) {
        console.log('🚀 Usando caché de cursos');
        renderCoursesTable(allCourses);
        updateStats();
        return;
    }

    try {
        const response = await fetch(apiUrl('/api/courses'));

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📦 Cursos recibidos:', data);

        if (data.success) {
            allCourses = (data.courses || []).filter(c => c._id || c.id);
            lastFetchTime = Date.now();
            renderCoursesTable(allCourses);
            updateStats();
        } else {
            showToast('Error en la respuesta del servidor', 'error');
        }
    } catch (error) {
        console.error('❌ Error fetching courses:', error);
        showToast('Error al cargar los cursos', 'error');
    }
}

async function createCourse(courseData) {
    try {
        const response = await fetch(apiUrl('/api/courses'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(courseData)
        });

        const data = await response.json();

        if (data.success) {
            showToast('Curso creado exitosamente');
            fetchCourses();
            closeCourseModal();
        } else {
            showToast(data.message || 'Error al crear el curso', 'error');
        }
    } catch (error) {
        console.error('Error creating course:', error);
        showToast('Error al crear el curso', 'error');
    }
}

async function updateCourse(id, courseData) {
    try {
        const response = await fetch(apiUrl(`/api/courses/${id}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(courseData)
        });

        const data = await response.json();

        if (data.success) {
            showToast('Curso actualizado exitosamente');
            fetchCourses();
            closeCourseModal();
        } else {
            showToast(data.message || 'Error al actualizar el curso', 'error');
        }
    } catch (error) {
        console.error('Error updating course:', error);
        showToast('Error al actualizar el curso', 'error');
    }
}

async function deleteCourse(id, courseName) {
    if (!confirm(`¿Estás seguro de eliminar el curso "${courseName}"?`)) {
        return;
    }

    try {
        const response = await fetch(apiUrl(`/api/courses/${id}`), {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast('Curso eliminado exitosamente');
            fetchCourses();
        } else {
            showToast(data.message || 'Error al eliminar el curso', 'error');
        }
    } catch (error) {
        console.error('Error deleting course:', error);
        showToast('Error al eliminar el curso', 'error');
    }
}

async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(apiUrl('/api/upload'), {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            return data.imageUrl;
        } else {
            showToast(data.message || 'Error al subir la imagen', 'error');
            return null;
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        showToast('Error al subir la imagen', 'error');
        return null;
    }
}

// ===================================
// Render Functions
// ===================================

function renderCoursesTable(courses) {
    const tbody = document.getElementById('coursesTableBody');

    if (!courses || courses.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-row">
                    <p>No hay cursos disponibles</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = courses.map(course => {
        // Asegurar que tenemos un ID válido
        const courseId = course._id || course.id;

        if (!courseId) {
            console.error('Curso sin ID encontrado:', course);
            return '';
        }

        return `
        <tr>
            <td><strong>#${typeof courseId === 'string' ? courseId.slice(-6) : courseId}</strong></td>
            <td>
                <img src="${course.thumbnail}" alt="${course.name}" class="thumbnail-cell" onerror="this.src='/images/default-course.jpg'">
            </td>
            <td><strong>${course.name}</strong></td>
            <td><span class="badge">${course.category}</span></td>
            <td>${course.totalChapters || (course.chapters ? course.chapters.length : 0)}</td>
            <td>${course.totalEpisodes || 0}</td>
            <td>
                ${course.featured
                ? '<span class="featured-badge"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.545 4.13L11 4.635L8.5 7.07L9.09 10.51L6 8.885L2.91 10.51L3.5 7.07L1 4.635L4.455 4.13L6 1Z" fill="currentColor"/></svg> Destacado</span>'
                : '<span class="not-featured">No</span>'}
            </td>
            <td>
                <div class="table-actions-cell">
                    <button class="btn-icon btn-content" onclick="window.location.href='/admin/content/${courseId}'" title="Gestionar Contenido">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-edit" onclick="editCourse('${courseId}')" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M11.333 2.00004C11.5081 1.82494 11.716 1.68605 11.9447 1.59129C12.1735 1.49653 12.4187 1.44775 12.6663 1.44775C12.914 1.44775 13.1592 1.49653 13.3879 1.59129C13.6167 1.68605 13.8246 1.82494 13.9997 2.00004C14.1748 2.17513 14.3137 2.383 14.4084 2.61178C14.5032 2.84055 14.552 3.08575 14.552 3.33337C14.552 3.58099 14.5032 3.82619 14.4084 4.05497C14.3137 4.28374 14.1748 4.49161 13.9997 4.66671L5.33301 13.3334L1.33301 14.6667L2.66634 10.6667L11.333 2.00004Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteCourse('${courseId}', '${course.name.replace(/'/g, "\\'")}')">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2 4H3.33333H14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M5.33301 4.00004V2.66671C5.33301 2.31309 5.47348 1.97395 5.72353 1.7239C5.97358 1.47385 6.31272 1.33337 6.66634 1.33337H9.33301C9.68663 1.33337 10.0258 1.47385 10.2758 1.7239C10.5259 1.97395 10.6663 2.31309 10.6663 2.66671V4.00004M12.6663 4.00004V13.3334C12.6663 13.687 12.5259 14.0261 12.2758 14.2762C12.0258 14.5262 11.6866 14.6667 11.333 14.6667H4.66634C4.31272 14.6667 3.97358 14.5262 3.72353 14.2762C3.47348 14.0261 3.33301 13.687 3.33301 13.3334V4.00004H12.6663Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function updateStats() {
    try {
        const totalCourses = allCourses ? allCourses.length : 0;
        const featuredCourses = allCourses ? allCourses.filter(c => c.featured).length : 0;
        const categoriesCount = categoriesData ? categoriesData.length : (allCourses ? [...new Set(allCourses.map(c => c.category))].length : 0);

        const elTotal = document.getElementById('totalCourses');
        const elFeatured = document.getElementById('featuredCourses');
        const elCat = document.getElementById('totalCategories');

        if (elTotal) elTotal.textContent = totalCourses;
        if (elFeatured) elFeatured.textContent = featuredCourses;
        if (elCat) elCat.textContent = categoriesCount;
    } catch (err) {
        console.error('Error in updateStats:', err);
    }
}

// ===================================
// Modal Functions
// ===================================

function openAddCourseModal() {
    editingCourseId = null;
    document.getElementById('modalTitle').textContent = 'Nuevo Curso';
    document.getElementById('courseForm').reset();
    document.getElementById('courseOrder').value = 0;
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('imagePreview').classList.remove('active');
    populateCategorySelect();
    document.getElementById('courseModal').classList.add('active');
}

function editCourse(id) {
    const course = allCourses.find(c => (c._id === id || c.id === id || c.id == id));
    if (!course) return;

    // Usar el ID correcto que tenga el objeto
    const courseId = course._id || course.id;
    editingCourseId = courseId;

    document.getElementById('modalTitle').textContent = 'Editar Curso';

    // Fill form
    document.getElementById('courseId').value = courseId;
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseCategory').value = course.category;
    document.getElementById('courseChapters').value = course.totalChapters || (course.chapters ? course.chapters.length : 0);
    document.getElementById('courseEpisodes').value = course.totalEpisodes || 0;
    document.getElementById('courseDescription').value = course.description || '';
    document.getElementById('courseVideoUrl').value = course.videoUrl || '';
    document.getElementById('thumbnailUrl').value = course.thumbnail || '';
    document.getElementById('courseFeatured').checked = (course.featured === true || course.featured === 'true');
    document.getElementById('courseOrder').value = course.order || 0;

    // Populate and select category
    populateCategorySelect(course.category);

    // Show thumbnail preview
    const preview = document.getElementById('imagePreview');
    if (course.thumbnail) {
        preview.innerHTML = `<img src="${course.thumbnail}" alt="Preview" onerror="this.src='/images/default-course.jpg'">`;
        preview.classList.add('active');
    } else {
        preview.innerHTML = '';
        preview.classList.remove('active');
    }

    document.getElementById('courseModal').classList.add('active');
}

function closeCourseModal() {
    document.getElementById('courseModal').classList.remove('active');
    document.getElementById('courseForm').reset();
    editingCourseId = null;
}

// ===================================
// Form Handlers
// ===================================

async function handleFormSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const submitBtnText = document.getElementById('submitBtnText');
    const submitSpinner = document.getElementById('submitSpinner');

    // Show loading state
    submitBtn.disabled = true;
    submitBtnText.style.display = 'none';
    submitSpinner.style.display = 'inline-block';

    const formData = {
        name: document.getElementById('courseName').value,
        category: document.getElementById('courseCategory').value,
        // chapters y episodes se calculan automáticamente
        description: document.getElementById('courseDescription').value,
        videoUrl: document.getElementById('courseVideoUrl').value,
        thumbnail: document.getElementById('thumbnailUrl').value || '/uploads/default-course.jpg',
        featured: document.getElementById('courseFeatured').checked,
        order: Number(document.getElementById('courseOrder').value) || 0
    };

    try {
        if (editingCourseId) {
            await updateCourse(editingCourseId, formData);
        } else {
            await createCourse(formData);
        }
    } finally {
        // Reset loading state
        submitBtn.disabled = false;
        submitBtnText.style.display = 'inline';
        submitSpinner.style.display = 'none';
    }
}

async function previewImage(input) {
    const preview = document.getElementById('imagePreview');
    const file = input.files[0];

    if (file) {
        // Validación de tamaño (ej: para evitar que base64 sobrepase el límite de MongoDB de 16MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast('La imagen es demasiado grande. Máximo 2MB.', 'error');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            preview.classList.add('active');

            // Asignar base64 directamente al campo de texto
            document.getElementById('thumbnailUrl').value = e.target.result;
            showToast('Imagen cargada y convertida a texto exitosamente', 'info');
        };
        reader.readAsDataURL(file);
    }
}

// ===================================
// Content Manager Functions
// ===================================

async function openContentManager(courseId) {
    // Si viene del string 'ID' o undefined, ignorar
    if (!courseId || courseId === 'undefined' || courseId === 'null') {
        console.error('ID de curso inválido:', courseId);
        showToast('Error: ID de curso no válido', 'error');
        return;
    }

    // Buscar curso actualizado desde la API para asegurar que tenemos los capítulos
    try {
        console.log('Fetching content for course:', courseId);
        const response = await fetch(apiUrl(`/api/courses/${courseId}`));

        if (!response.ok) {
            const textText = await response.text();
            console.error('API Error:', response.status, textText);
            throw new Error(`Error del servidor: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            currentContentCourseId = courseId;
            const course = data.course;

            document.getElementById('contentCourseName').textContent = course.name;
            renderChapters(course);

            document.getElementById('contentModal').classList.add('active');
        } else {
            showToast(data.message || 'Error al cargar curso', 'error');
        }
    } catch (error) {
        console.error('Error fetching course for content:', error);
        showToast('Error al cargar contenido del curso', 'error');
    }
}

function closeContentModal() {
    document.getElementById('contentModal').classList.remove('active');
    currentContentCourseId = null;
    document.getElementById('chaptersList').innerHTML = '';
}

function renderChapters(course) {
    const container = document.getElementById('chaptersList');

    if (!course.chapters || course.chapters.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.3); padding: 3rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">No hay capítulos creados aún.</div>';
        return;
    }

    container.innerHTML = course.chapters.map((chapter, index) => {
        const episodeCount = chapter.episodes ? chapter.episodes.length : 0;
        
        return `
        <div class="chapter-item ${index === 0 ? 'active' : ''}" id="chapter-${chapter._id}">
            <div class="chapter-header" onclick="toggleChapter(event, '${chapter._id}')">
                <div class="chapter-title-group">
                    <div style="width: 32px; height: 32px; background: rgba(124,58,237,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #7C3AED; font-weight: 800; font-size: 0.8rem;">
                        ${index + 1}
                    </div>
                    <div>
                        <h3>${chapter.title}</h3>
                        ${chapter.description ? `<p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: rgba(255,255,255,0.4); font-weight: 400;">${chapter.description}</p>` : ''}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 1.5rem;">
                    <div class="chapter-badge-count">
                        ${episodeCount}
                        <span>CLASES</span>
                    </div>
                    <div class="chapter-actions">
                        <button class="btn-icon btn-edit btn-small" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);" onclick="editChapter(event, '${chapter._id}', '${chapter.title}', '${chapter.description || ''}')" title="Editar Capítulo">
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn-icon btn-delete btn-small" style="background: rgba(255,75,85,0.1); border: 1px solid rgba(255,75,85,0.2); color: #FF4B55;" onclick="deleteChapter(event, '${chapter._id}')" title="Eliminar Capítulo">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            <div class="episodes-list">
                ${chapter.episodes && chapter.episodes.length > 0
                ? chapter.episodes.map((episode, epIndex) => `
                        <div class="episode-item">
                            <div class="episode-thumb-container">
                                ${episode.thumbnail ? `<img src="${episode.thumbnail}" alt="">` : '<i>🎬</i>'}
                            </div>
                            <div class="episode-content-info">
                                <div class="episode-title-row">
                                    EPISODIO ${index + 1} CAPITULO ${epIndex + 1}: ${episode.title}
                                </div>
                                <div class="episode-meta-row">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    ${episode.duration || '0:00'}
                                </div>
                            </div>
                            <div class="episode-actions-inline">
                                <button class="btn-icon btn-edit btn-small" style="width: 32px; height: 32px; background: rgba(255,255,255,0.05);" onclick="editEpisode(event, '${chapter._id}', '${episode._id}', '${episode.title}', '${episode.videoUrl}', '${episode.duration || ''}', '${episode.thumbnail || ''}')" title="Editar Episodio">
                                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                </button>
                                <button class="btn-icon btn-delete btn-small" style="width: 32px; height: 32px; background: rgba(255,75,85,0.05); color: #FF4B55;" onclick="deleteEpisode(event, '${chapter._id}', '${episode._id}')" title="Eliminar Episodio">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `).join('')
                : '<p style="font-size: 0.8rem; color: rgba(255,255,255,0.2); padding: 1.5rem; text-align: center; background: rgba(0,0,0,0.1); border-radius: 8px;">No hay episodios en este capítulo.</p>'
                }
                
                <div class="add-episode-form-premium">
                    <p style="font-size: 0.7rem; font-weight: 800; color: #7C3AED; text-transform: uppercase; margin-bottom: 0.75rem;">+ Nuevo Episodio</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                        <input type="text" placeholder="Título Episodio" id="ep-title-${chapter._id}" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 0.6rem 0.8rem; font-size: 0.85rem;">
                        <input type="text" placeholder="URL Video (Embed)" id="ep-url-${chapter._id}" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 0.6rem 0.8rem; font-size: 0.85rem;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                        <input type="text" placeholder="Duración (Ej: 12:45)" id="ep-dur-${chapter._id}" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 0.6rem 0.8rem; font-size: 0.85rem;">
                        <input type="text" placeholder="URL Imagen Fondo (Opcional)" id="ep-thumb-${chapter._id}" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 0.6rem 0.8rem; font-size: 0.85rem;">
                    </div>
                    <button class="btn-primary btn-small" onclick="addEpisode('${chapter._id}')" style="width: 100%; padding: 0.7rem; background: #7C3AED; font-weight: 700;">Añadir Episodio</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Funciones para editar (Implementación básica inline por ahora)
async function editChapter(e, chapterId, currentTitle, currentDesc) {
    if (e) e.stopPropagation();
    const newTitle = prompt('Nuevo título del capítulo:', currentTitle);
    if (newTitle === null) return; // Cancelado
    const newDesc = prompt('Nueva descripción:', currentDesc);
    if (newDesc === null) return;

    try {
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, description: newDesc })
        });
        if (response.ok) {
            showToast('Capítulo actualizado');
            openContentManager(currentContentCourseId);
            // fetchCourses(); // Eliminado redundante
        } else {
            showToast('Error al actualizar', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error de conexión', 'error');
    }
}

async function editEpisode(e, chapterId, episodeId, currentTitle, currentUrl, currentDur, currentThumb) {
    if (e) e.stopPropagation();
    const newTitle = prompt('Nuevo título del episodio:', currentTitle);
    if (newTitle === null) return;
    const newUrl = prompt('Nueva URL del video:', currentUrl);
    if (newUrl === null) return;
    const newDur = prompt('Nueva duración:', currentDur);
    if (newDur === null) return;
    const newThumb = prompt('Nueva URL de imagen fondo:', currentThumb);
    if (newThumb === null) return;

    try {
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}/episodes/${episodeId}`), {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ title: newTitle, videoUrl: newUrl, duration: newDur, thumbnail: newThumb })
        });
        if (response.ok) {
            showToast('Episodio actualizado');
            openContentManager(currentContentCourseId);
        } else {
            showToast('Error al actualizar', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error de conexión', 'error');
    }
}

function toggleChapter(e, chapterId) {
    // Si se hace click en acciones o inputs, no hacer nada
    if (e.target.closest('.chapter-actions') || e.target.closest('.add-episode-form-premium') || e.target.closest('.episode-actions-inline') || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

    // Toggle active
    const item = document.getElementById(`chapter-${chapterId}`);
    if (item) item.classList.toggle('active');
}

function openAddChapterInput() {
    document.getElementById('newChapterInput').style.display = 'block';
    document.getElementById('newChapterTitle').focus();
}

async function saveNewChapter() {
    const title = document.getElementById('newChapterTitle').value;
    const description = document.getElementById('newChapterDesc').value;

    if (!title) {
        showToast('El título del capítulo es obligatorio', 'error');
        return;
    }

    try {
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Capítulo agregado');
            document.getElementById('newChapterTitle').value = '';
            document.getElementById('newChapterDesc').value = '';
            document.getElementById('newChapterInput').style.display = 'none';

            // Recargar vista
            openContentManager(currentContentCourseId);
            // fetchCourses(); // Eliminado redundante
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Error al agregar capítulo', 'error');
    }
}

async function deleteChapter(e, chapterId) {
    if (e) e.stopPropagation();

    if (!confirm('¿Seguro que quieres eliminar este capítulo y sus episodios?')) return;

    try {
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}`), {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast('Capítulo eliminado');
            openContentManager(currentContentCourseId);
            // fetchCourses(); // Eliminado redundante
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Error al eliminar capítulo', 'error');
    }
}

async function addEpisode(chapterId) {
    const title = document.getElementById(`ep-title-${chapterId}`).value;
    const videoUrl = document.getElementById(`ep-url-${chapterId}`).value;
    const duration = document.getElementById(`ep-dur-${chapterId}`).value;
    const thumbnail = document.getElementById(`ep-thumb-${chapterId}`).value;

    if (!title || !videoUrl) {
        showToast('Título y URL son obligatorios', 'error');
        return;
    }

    try {
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}/episodes/new`), {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ title, videoUrl, duration, thumbnail })
        });
        if (response.ok) {
            showToast('Episodio añadido');
            openContentManager(currentContentCourseId);
        } else {
            showToast('Error al añadir episodio', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error de conexión', 'error');
    }
}

async function deleteEpisode(e, chapterId, episodeId) {
    if (e) e.stopPropagation();
    if (!confirm('¿Eliminar este episodio?')) return;

    try {
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}/episodes/${episodeId}`), {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast('Episodio eliminado');
            openContentManager(currentContentCourseId);
            // fetchCourses(); // Eliminado redundante
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Error al eliminar episodio', 'error');
    }
}

// ===================================
// Search/Filter
// ===================================

function setupSearch() {
    const searchInput = document.getElementById('searchTable');

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();

        const filtered = allCourses.filter(course =>
            course.name.toLowerCase().includes(searchTerm) ||
            course.category.toLowerCase().includes(searchTerm) ||
            (course._id && course._id.toString().includes(searchTerm))
        );

        renderCoursesTable(filtered);
    });
}

// ===================================
// Toast Notification
// ===================================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===================================
// Admin helpers
// ===================================
function adminToken() {
    return localStorage.getItem('authToken');
}
function adminLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    window.location.href = '/login';
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken()}`
    };
}

// ===================================
// Tab navigation
// ===================================
let membershipsData = [];
let usersData = [];
let editingMembershipId = null;
let editingUserId = null;
let settingsLoaded = false;
let lastSavedSettings = null; 
let currentUserFilter = 'all'; // 'all', 'active', 'inactive'
let usersCurrentPage = 1;
const usersPerPage = 10;
let selectedUserIdForDetails = null;

function switchTab(tab) {
    activeTab = tab;
    ['courses', 'memberships', 'banners', 'users', 'logo', 'categories', 'commissions', 'landing'].forEach(t => {
        const section = document.getElementById(`section-${t}`);
        if (section) section.style.display = t === tab ? '' : 'none';


        const btn = document.getElementById(`tab-${t}`);
        if (btn) {
            btn.style.color = t === tab ? '#fff' : 'rgba(255,255,255,.5)';
            btn.style.borderBottom = t === tab ? '2px solid #7C3AED' : '2px solid transparent';
        }
    });

    const btnNewCourse = document.getElementById('btnNewCourse');
    if (btnNewCourse) btnNewCourse.style.display = tab === 'courses' ? '' : 'none';

    if (tab === 'courses') fetchCourses();
    if (tab === 'memberships') loadMemberships();
    if (tab === 'categories') loadCategories();
    if (tab === 'landing') loadLandingConfig();

    if (tab === 'banners' || tab === 'logo') {
        // Solo cargamos settings la primera vez, luego se preserva el estado local
        if (!settingsLoaded) loadSettings();
        else if (lastSavedSettings && tab === 'logo') {
            // Usar los valores guardados localmente si existen
            document.getElementById('configCompanyName').value = lastSavedSettings.companyName || '';
            document.getElementById('configLogoUrl').value = lastSavedSettings.logoUrl || '';
        }
        if (tab === 'banners') loadBanners();
    }
    if (tab === 'users') loadUsers();
    if (tab === 'commissions') loadCommissionsData();
}

// ===================================
// CATEGORIES ADMIN
// ===================================

async function loadCategories() {
    try {
        const res = await fetch(apiUrl('/api/admin/categories'), { headers: authHeaders() });
        const data = await res.json();
        if (data.success) {
            categoriesData = data.categories;
            renderCategoriesTable(data.categories);
            updateStats();
        } else {
            showToast(data.message || 'Error al cargar categorías', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

function renderCategoriesTable(categories) {
    const tbody = document.getElementById('categoriesTableBody');
    if (!categories || categories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="loading-row"><p>No hay categorías creadas</p></td></tr>`;
        return;
    }
    tbody.innerHTML = categories.map(cat => `
        <tr>
            <td><strong>${cat.name}</strong></td>
            <td>
                <div class="table-actions-cell">
                    <button class="btn-icon btn-edit" onclick="openCategoryModal('${cat._id}')" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M11.333 2.00004C11.5081 1.82494 11.716 1.68605 11.9447 1.59129C12.1735 1.49653 12.4187 1.44775 12.6663 1.44775L5.33301 13.3334L1.33301 14.6667L2.66634 10.6667L11.333 2.00004Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteCategory('${cat._id}', '${cat.name}')">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4H3.33333H14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.33301 4.00004V2.66671C5.33301 2.31309 5.47348 1.97395 5.72353 1.7239C5.97358 1.47385 6.31272 1.33337 6.66634 1.33337H9.33301C9.68663 1.33337 10.0258 1.47385 10.2758 1.7239C10.5259 1.97395 10.6663 2.31309 10.6663 2.66671V4.00004M12.6663 4.00004V13.3334C12.6663 13.687 12.5259 14.0261 12.2758 14.2762C12.0258 14.5262 11.6866 14.6667 11.333 14.6667H4.66634C4.31272 14.6667 3.97358 14.5262 3.72353 14.2762C3.47348 14.0261 3.33301 13.687 3.33301 13.3334V4.00004H12.6663Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openCategoryModal(id) {
    editingCategoryId = id || null;
    document.getElementById('categoryModalTitle').textContent = id ? 'Editar Categoría' : 'Nueva Categoría';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = id || '';
    
    if (id) {
        const cat = categoriesData.find(c => c._id === id);
        if (cat) {
            document.getElementById('catName').value = cat.name;
        }
    }
    
    document.getElementById('categoryModal').classList.add('active');
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
    editingCategoryId = null;
}

async function saveCategory(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const submitText = document.getElementById('catSubmitText');
    const spinner = document.getElementById('catSubmitSpinner');

    btn.disabled = true;
    submitText.style.display = 'none';
    spinner.style.display = 'inline-block';

    const formData = {
        name: document.getElementById('catName').value.trim()
    };

    try {
        const url = editingCategoryId ? `/api/admin/categories/${editingCategoryId}` : '/api/admin/categories';
        const method = editingCategoryId ? 'PUT' : 'POST';

        const res = await fetch(apiUrl(url), {
            method,
            headers: authHeaders(),
            body: JSON.stringify(formData)
        });
        const data = await res.json();
        
        if (data.success) {
            showToast(editingCategoryId ? 'Categoría actualizada' : 'Categoría creada');
            closeCategoryModal();
            loadCategories();
        } else {
            showToast(data.message || 'Error al guardar categoría', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        submitText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

async function deleteCategory(id, name) {
    if (!confirm(`¿Estás seguro de eliminar la categoría "${name}"?`)) return;
    try {
        const res = await fetch(apiUrl(`/api/admin/categories/${id}`), {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();
        if (data.success) {
            showToast('Categoría eliminada');
            loadCategories();
        } else {
            showToast(data.message || 'Error al eliminar', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

async function populateCategorySelect(selectedValue = '') {
    const select = document.getElementById('courseCategory');
    if (!select) return;

    try {
        // Si no hay datos, los cargamos
        if (categoriesData.length === 0) {
            const res = await fetch(apiUrl('/api/categories'));
            const data = await res.json();
            if (data.success) {
                categoriesData = data.categories;
            }
        }

        select.innerHTML = '<option value="">Seleccionar...</option>' + 
            categoriesData.map(cat => `<option value="${cat.name}" ${cat.name === selectedValue ? 'selected' : ''}>${cat.name}</option>`).join('');
    } catch (err) {
        console.error('Error populating categories:', err);
        select.innerHTML = '<option value="">Error al cargar categorías</option>';
    }
}

// ===================================
// MEMBERSHIPS ADMIN
// ===================================

async function loadMemberships() {
    try {
        const res = await fetch(apiUrl('/api/admin/memberships'), { headers: authHeaders() });
        const data = await res.json();
        if (data.success) {
            membershipsData = data.memberships;
            renderMembershipsGrid(data.memberships);
            renderCommissionPlansTable(data.memberships);
        } else {
            showToast(data.message || 'Error al cargar planes', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

function getDurationLabel(days) {
    if (days === 0) return 'De por vida';
    if (days === 1095) return '3 años';
    if (days === 365) return '1 año';
    if (days === 30) return '1 mes';
    if (days === 90) return '3 meses';
    if (days === 180) return '6 meses';
    if (days === 7) return '1 semana';
    return `${days} días`;
}

function renderMembershipsGrid(plans) {
    const grid = document.getElementById('membershipsGrid');
    if (!plans || plans.length === 0) {
        grid.innerHTML = `<div style="text-align:center;padding:3rem;color:rgba(255,255,255,.4);grid-column:1/-1;">
            <div style="font-size:2rem;margin-bottom:.75rem;">📭</div>
            <p>No hay planes creados. Crea el primero con el botón "Nuevo Plan".</p>
        </div>`;
        return;
    }
    grid.innerHTML = plans.map(p => `
        <div style="background:rgba(20,20,35,.85);border:1px solid ${p.isActive ? 'rgba(124,58,237,.3)' : 'rgba(255,255,255,.08)'};border-radius:20px;padding:1.5rem;position:relative;transition:all .25s;">
            ${!p.isActive ? '<div style="position:absolute;top:1rem;right:1rem;background:rgba(255,75,85,.15);border:1px solid rgba(255,75,85,.3);color:#FF6B70;font-size:.7rem;font-weight:700;padding:.2rem .6rem;border-radius:100px;">INACTIVO</div>' : ''}
            ${p.badge ? `<div style="position:absolute;top:1rem;right:1rem;background:${p.color || '#7C3AED'};color:#fff;font-size:.7rem;font-weight:700;padding:.25rem .75rem;border-radius:100px;">${p.badge}</div>` : ''}
            <div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:.5rem;">
                ${p.icon && (p.icon.startsWith('http') || p.icon.startsWith('data:')) ? `<img src="${p.icon}" style="width:100%;height:100%;object-fit:contain;">` : (p.icon || '🚀')}
            </div>
            <div style="font-size:1.25rem;font-weight:800;margin-bottom:.25rem;">${p.name}</div>

            <div style="font-size:2rem;font-weight:900;color:${p.color || '#7C3AED'};margin:.5rem 0;">${p.currency === 'USD' ? '$' : 'S/'} ${p.price}</div>

            <div style="font-size:.8rem;color:rgba(255,255,255,.4);margin-bottom:1rem;">${getDurationLabel(p.durationDays)}</div>
            ${p.description ? `<div style="font-size:.85rem;color:rgba(255,255,255,.55);margin-bottom:1rem;">${p.description}</div>` : ''}
            ${p.features && p.features.length ? `<ul style="list-style:none;margin-bottom:1rem;">${p.features.slice(0, 3).map(f => `<li style="font-size:.8rem;color:rgba(255,255,255,.6);padding:.2rem 0;">✓ ${f}</li>`).join('')}${p.features.length > 3 ? `<li style="font-size:.75rem;color:rgba(255,255,255,.3);">+${p.features.length - 3} más...</li>` : ''}</ul>` : ''}
            <div style="display:flex;gap:.5rem;margin-top:auto;">
                <button onclick="editMembership('${p._id}')" style="flex:1;padding:.6rem;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);color:#A78BFA;border-radius:10px;cursor:pointer;font-size:.875rem;font-family:inherit;transition:all .2s;">✏️ Editar</button>
                <button onclick="deleteMembership('${p._id}','${p.name}')" style="padding:.6rem .75rem;background:rgba(255,75,85,.1);border:1px solid rgba(255,75,85,.2);color:#FF6B70;border-radius:10px;cursor:pointer;font-size:.875rem;font-family:inherit;transition:all .2s;">🗑️</button>
            </div>
        </div>
    `).join('');
}

function openMembershipModal(id) {
    editingMembershipId = id || null;
    document.getElementById('membershipModalTitle').textContent = id ? 'Editar Plan' : 'Nuevo Plan de Membresía';
    document.getElementById('membershipForm').reset();
    document.getElementById('membershipId').value = '';
    document.getElementById('membIcon').value = '🚀';
    document.getElementById('membColor').value = '#7C3AED';

    document.getElementById('membButtonColor').value = '#7C3AED';
    document.getElementById('membActive').checked = true;
    document.getElementById('membSellerCommission').value = 0;
    document.getElementById('featuresContainer').innerHTML = `
        <div class="feature-row" style="display:flex;gap:.5rem;margin-bottom:.5rem;">
            <input type="text" class="feature-input" placeholder="Ej: Acceso a todos los cursos" style="flex:1;">
            <button type="button" onclick="removeFeatureRow(this)" style="background:rgba(255,75,85,.15);border:none;color:#FF6B70;border-radius:8px;padding:0 .75rem;cursor:pointer;font-size:1.1rem;">×</button>
        </div>`;

    if (id) {
        const plan = membershipsData.find(p => p._id === id);
        if (plan) {
            document.getElementById('membershipId').value = plan._id;
            document.getElementById('membName').value = plan.name;
            document.getElementById('membPrice').value = plan.price;
            document.getElementById('membCurrency').value = plan.currency || 'PEN';
            document.getElementById('membDuration').value = plan.durationDays;
            document.getElementById('membBadge').value = plan.badge || '';
            document.getElementById('membDesc').value = plan.description || '';
            
            const iconInput = document.getElementById('membIcon');
            if (plan.icon && (plan.icon.startsWith('http') || plan.icon.startsWith('data:'))) {
                iconInput.value = '🖼️ Imagen Cargada';
                iconInput.dataset.iconUrl = plan.icon;
            } else {
                iconInput.value = plan.icon || '🚀';
                delete iconInput.dataset.iconUrl;
            }

            const preview = document.getElementById('membIconPreview');
            if (preview && plan.icon && (plan.icon.startsWith('http') || plan.icon.startsWith('data:'))) {
                preview.style.backgroundImage = `url('${plan.icon}')`;
                preview.textContent = '';
            } else if (preview) {
                preview.style.backgroundImage = '';
                preview.textContent = '📷';
            }

            document.getElementById('membColor').value = plan.color || '#7C3AED';

            document.getElementById('membButtonColor').value = plan.buttonColor || plan.color || '#7C3AED';
            document.getElementById('membActive').checked = plan.isActive;
            document.getElementById('membSellerCommission').value = plan.sellerCommission || 0;

            // Features
            const container = document.getElementById('featuresContainer');
            if (plan.features && plan.features.length) {
                container.innerHTML = plan.features.map(f => `
                    <div class="feature-row" style="display:flex;gap:.5rem;margin-bottom:.5rem;">
                        <input type="text" class="feature-input" value="${f}" style="flex:1;">
                        <button type="button" onclick="removeFeatureRow(this)" style="background:rgba(255,75,85,.15);border:none;color:#FF6B70;border-radius:8px;padding:0 .75rem;cursor:pointer;font-size:1.1rem;">×</button>
                    </div>`).join('');
            }
        }
    }
    document.getElementById('membershipModal').classList.add('active');
}

function editMembership(id) { openMembershipModal(id); }

function closeMembershipModal() {
    document.getElementById('membershipModal').classList.remove('active');
    editingMembershipId = null;
}

function addFeatureRow() {
    const container = document.getElementById('featuresContainer');
    const row = document.createElement('div');
    row.className = 'feature-row';
    row.style.cssText = 'display:flex;gap:.5rem;margin-bottom:.5rem;';
    row.innerHTML = `
        <input type="text" class="feature-input" placeholder="Beneficio del plan" style="flex:1;">
        <button type="button" onclick="removeFeatureRow(this)" style="background:rgba(255,75,85,.15);border:none;color:#FF6B70;border-radius:8px;padding:0 .75rem;cursor:pointer;font-size:1.1rem;">×</button>`;
    container.appendChild(row);
}

function removeFeatureRow(btn) {
    const container = document.getElementById('featuresContainer');
    if (container.querySelectorAll('.feature-row').length > 1) {
        btn.parentElement.remove();
    }
}

async function saveMembership(e) {
    e.preventDefault();
    const id = document.getElementById('membershipId').value;
    const features = [...document.querySelectorAll('.feature-input')].map(i => i.value.trim()).filter(Boolean);

    const iconInput = document.getElementById('membIcon');
    const payload = {
        name: document.getElementById('membName').value,
        price: document.getElementById('membPrice').value,
        currency: document.getElementById('membCurrency').value,
        durationDays: document.getElementById('membDuration').value,
        badge: document.getElementById('membBadge').value,
        description: document.getElementById('membDesc').value,
        icon: iconInput.dataset.iconUrl || iconInput.value,
        color: document.getElementById('membColor').value,
        buttonColor: document.getElementById('membButtonColor').value,
        isActive: document.getElementById('membActive').checked,
        sellerCommission: Number(document.getElementById('membSellerCommission').value) || 0,
        features
    };


    console.log('📦 Saving Membership:', { id, payload });

    document.getElementById('membSubmitText').style.display = 'none';
    document.getElementById('membSubmitSpinner').style.display = 'inline-block';

    try {
        const url = id ? apiUrl(`/api/admin/memberships/${id}`) : apiUrl('/api/admin/memberships');
        const method = id ? 'PUT' : 'POST';

        console.log(`🚀 Sending ${method} request to: ${url}`);

        const res = await fetch(url, {
            method,
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log('📥 Server Response:', data);

        if (data.success) {
            showToast(id ? 'Plan actualizado' : 'Plan creado exitosamente');
            closeMembershipModal();
            loadMemberships();
        } else {
            showToast(data.message || 'Error al guardar', 'error');
        }
    } catch (err) {
        console.error('❌ Error saving membership:', err);
        showToast('Error de conexión', 'error');
    } finally {
        document.getElementById('membSubmitText').style.display = '';
        document.getElementById('membSubmitSpinner').style.display = 'none';
    }
}

async function deleteMembership(id, name) {
    if (!confirm(`¿Eliminar el plan "${name}"?`)) return;
    try {
        const res = await fetch(apiUrl(`/api/admin/memberships/${id}`), { method: 'DELETE', headers: authHeaders() });
        const data = await res.json();
        if (data.success) {
            showToast('Plan eliminado');
            loadMemberships();
        } else {
            showToast(data.message || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// ===================================
// USERS ADMIN
// ===================================

// ===================================
// GESTIÓN DE USUARIOS (3 sub-tabs)
// ===================================

let activeUserSubTab = 'user'; // 'user' | 'vendedor' | 'admin'

function switchUserSubTab(type) {
    activeUserSubTab = type;
    ['user', 'vendedor', 'admin', 'commission'].forEach(t => {
        const tab = document.getElementById(`usub-tab-${t}`);
        const section = document.getElementById(`usersub-${t}`);
        if (!tab || !section) return;

        if (t === type) {
            tab.style.background = t === 'user' ? 'rgba(79,255,176,.15)' : t === 'vendedor' ? 'rgba(124,58,237,.2)' : t === 'commission' ? 'rgba(167,139,250,.2)' : 'rgba(79,70,229,.2)';
            tab.style.color = t === 'user' ? '#4FFFB0' : t === 'vendedor' ? '#c4b5fd' : t === 'commission' ? '#A78BFA' : '#818cf8';
            section.style.display = 'block';
        } else {
            tab.style.background = 'transparent';
            tab.style.color = 'rgba(255,255,255,.5)';
            section.style.display = 'none';
        }
    });
    // Update button text for "Nuevo Usuario"
    const btn = document.getElementById('btnNewUserMain');
    if (btn) {
        const labels = { user: 'Nuevo Usuario', vendedor: 'Nuevo Vendedor', admin: 'Nuevo Admin', commission: 'Nuevo Plan' };
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1V15M1 8H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> ${labels[type] || 'Nuevo'}`;
        
        if (type === 'commission') {
            btn.onclick = () => { switchTab('memberships'); openMembershipModal(); };
        } else {
            btn.onclick = () => openCreateUserModal(type);
        }
    }

    if (type === 'commission') {
        loadMemberships(); // Asegurar que los datos de planes estén cargados
    }
}

async function loadUsers() {
    try {
        const res = await fetch(apiUrl('/api/admin/users'), { headers: authHeaders() });
        const data = await res.json();
        if (data.success) {
            usersData = data.users;
            renderAllUserTables(data.users);
        } else {
            showToast(data.message || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

function renderAllUserTables(users) {
    const normalUsers = users.filter(u => u.role === 'user');
    const vendors = users.filter(u => u.role === 'vendedor');
    const admins = users.filter(u => u.role === 'admin');

    renderUsersTable(normalUsers);
    renderVendedoresTable(vendors);
    renderAdminsTable(admins);
    renderUserStatsBar(normalUsers.length, vendors.length, admins.length);
}

function filterUsersTable(query) {
    if (!usersData) return;
    const q = query.toLowerCase();
    const filtered = usersData.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        u.sellerCode?.toLowerCase().includes(q)
    );
    renderAllUserTables(filtered);
}

function renderUserStatsBar(users, vendors, admins) {
    const bar = document.getElementById('usersStatsBar');
    if (!bar) return;
    bar.innerHTML = [
        { label: 'Usuarios', count: users, color: '#4FFFB0', bg: 'rgba(79,255,176,.1)', border: 'rgba(79,255,176,.2)' },
        { label: 'Vendedores', count: vendors, color: '#c4b5fd', bg: 'rgba(124,58,237,.1)', border: 'rgba(124,58,237,.3)' },
        { label: 'Admins', count: admins, color: '#818cf8', bg: 'rgba(79,70,229,.1)', border: 'rgba(79,70,229,.3)' },
        { label: 'Total', count: users + vendors + admins, color: '#fff', bg: 'rgba(255,255,255,.05)', border: 'rgba(255,255,255,.1)' },
    ].map(s => `
        <div style="padding:.6rem 1.25rem;background:${s.bg};border:1px solid ${s.border};border-radius:10px;min-width:90px;">
            <div style="font-size:1.5rem;font-weight:800;color:${s.color};">${s.count}</div>
            <div style="font-size:.7rem;color:rgba(255,255,255,.4);margin-top:.1rem;">${s.label}</div>
        </div>
    `).join('');
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    const paginationContainer = document.getElementById('usersPagination');
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-row"><p>No hay usuarios registrados</p></td></tr>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    const now = new Date();
    const totalPages = Math.ceil(users.length / usersPerPage);
    if (usersCurrentPage > totalPages) usersCurrentPage = totalPages || 1;
    const start = (usersCurrentPage - 1) * usersPerPage;
    const paginated = users.slice(start, start + usersPerPage);

    tbody.innerHTML = paginated.map(u => {
        const isActive = u.membershipExpiresAt && new Date(u.membershipExpiresAt) > now;
        const expDate = u.membershipExpiresAt ? new Date(u.membershipExpiresAt).toLocaleDateString('es-PE') : '-';
        return `
        <tr>
            <td><strong style="color:#fff;">${u.name}</strong> <span style="color:rgba(255,255,255,.5);font-size:.8rem;">${u.lastName || ''}</span></td>
            <td style="font-size:.85rem;color:#fff;">${u.email}</td>
            <td style="font-size:.85rem;color:#fff;">${u.phone || '-'}</td>
            <td style="font-size:.85rem;color:#fff;">${u.country || '-'}</td>
            <td style="font-size:.8rem;">${(() => {
                if (!u.referredBy) return '<span style="color:rgba(255,255,255,.3);">-</span>';
                // Buscar el vendedor por su _id en usersData
                const seller = usersData && usersData.find(s => s._id === u.referredBy || s._id?.toString() === u.referredBy?.toString());
                if (seller) return `<span style="color:#c4b5fd;font-weight:600;">${seller.name} ${seller.lastName || ''}</span><br><code style="font-size:.7rem;color:rgba(196,181,253,.6);">${seller.sellerCode || ''}</code>`;
                return '<span style="color:rgba(196,181,253,.5);font-size:.75rem;">Referido</span>';
            })()}</td>
            <td>${isActive ? `<span style="background:rgba(79,255,176,.15);color:#4FFFB0;font-size:.75rem;font-weight:700;padding:.25rem .7rem;border-radius:100px;border:1px solid rgba(79,255,176,.3);">${u.membershipPlan || 'Activa'}</span>` : '<span style="color:rgba(255,255,255,.3);font-size:.8rem;">Sin membresía</span>'}</td>
            <td style="font-size:.8rem;color:#fff;">${isActive ? expDate : '-'}</td>
            <td>
                <div style="display:flex;gap:.4rem;">
                    <button onclick="openUserMembershipModal('${u._id}','${u.name.replace(/'/g, "\\'")}')"
                        title="Membresía" style="padding:.35rem .6rem;background:rgba(124,58,237,.3);border:1px solid rgba(124,58,237,.5);color:#c4b5fd;border-radius:8px;cursor:pointer;">💎</button>
                    <button onclick="openUserDetailsModal('${u._id}')"
                        title="Editar Perfil" style="padding:.35rem .6rem;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.8);border-radius:8px;cursor:pointer;">📝</button>
                </div>
            </td>
        </tr>`;
    }).join('');
    renderUsersPagination(users.length);
}

function renderVendedoresTable(vendors) {
    const tbody = document.getElementById('vendedoresTableBody');
    if (!vendors || vendors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row"><p>No hay vendedores registrados</p></td></tr>';
        return;
    }
    tbody.innerHTML = vendors.map(v => {
        // Encontrar el porcentaje: Prioridad Membresía Activa > sellerCommission > 10%
        let displayPct = 10;
        if (v.activeMembership) {
            const plan = membershipsData && membershipsData.find(m => m._id === v.activeMembership || m._id?.toString() === v.activeMembership?.toString());
            if (plan && plan.sellerCommission > 0) {
                displayPct = plan.sellerCommission;
            } else {
                displayPct = v.sellerCommission || 10;
            }
        } else {
            displayPct = v.sellerCommission || 10;
        }

        return `
        <tr>
            <td><strong style="color:#fff;">${v.name}</strong> <span style="color:rgba(255,255,255,.5);font-size:.8rem;">${v.lastName || ''}</span></td>
            <td style="font-size:.85rem;color:#fff;">${v.email}</td>
                <td>${v.sellerCode
                    ? `<code style="background:rgba(124,58,237,.2);padding:.25rem .6rem;border-radius:6px;font-size:.8rem;font-weight:700;color:#c4b5fd;border:1px solid rgba(124,58,237,.3);letter-spacing:.05em;">${v.sellerCode}</code>`
                    : '<span style="color:rgba(255,75,85,.7);font-size:.8rem;">⚠ Sin código</span>'}
                </td>
                <td>
                    <span style="background:rgba(79,255,176,.12);border:1px solid rgba(79,255,176,.25);color:#4FFFB0;padding:.2rem .6rem;border-radius:999px;font-size:.8rem;font-weight:800;">
                        ${Number(displayPct).toFixed(1)}%
                    </span>
                </td>
                <td style="color:#fff;">S/ ${(v.sellerBalance || 0).toFixed(2)}</td>
                <td style="color:#fff;">${v.referralCount ?? 0}</td>
            <td>
                <div style="display:flex;gap:.4rem;">
                    <button onclick="openEditPermissionsModal('${v._id}','${v.name.replace(/'/g, "\\'") } ${v.lastName?.replace(/'/g, "\\'") || ''}','${v.role}','${(v.permissions||[]).join(',')}','${v.canCreate}','${v.canEdit}')"
                        title="Permisiones" style="padding:.35rem .6rem;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.8);border-radius:8px;cursor:pointer;">🔑</button>
                    <button onclick="openUserDetailsModal('${v._id}')"
                        title="Editar Perfil" style="padding:.35rem .6rem;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.8);border-radius:8px;cursor:pointer;">📝</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderCommissionPlansTable(plans) {
    const tbody = document.getElementById('commissionPlansTableBody');
    if (!tbody) return;
    if (!plans || plans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-row"><p>No hay planes configurados</p></td></tr>';
        return;
    }

    tbody.innerHTML = plans.map(p => {
        const sym = p.currency === 'USD' ? '$' : 'S/';
        return `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:.6rem;">
                    <div style="background:${p.color || '#7C3AED'};width:10px;height:10px;border-radius:50%;"></div>
                    <strong style="color:#fff;">${p.name}</strong>
                </div>
            </td>
            <td style="color:#fff;">${sym} ${p.price.toFixed(2)}</td>
            <td>
                <div style="display:flex;align-items:center;gap:.5rem;">
                    <span style="background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.3);color:#A78BFA;padding:.3rem .8rem;border-radius:999px;font-weight:800;font-size:1rem;">
                        ${p.sellerCommission || 0}%
                    </span>
                </div>
            </td>
            <td>
                ${p.isActive 
                    ? '<span style="color:#4FFFB0;font-size:.75rem;font-weight:700;">● Activo</span>' 
                    : '<span style="color:rgba(255,255,255,.3);font-size:.75rem;">○ Inactivo</span>'}
            </td>
            <td>
                <button onclick="openEditMembershipModal('${p._id}')" 
                    style="padding:.35rem .8rem;background:rgba(124,58,237,.2);border:1px solid rgba(124,58,237,.4);color:#c4b5fd;border-radius:8px;cursor:pointer;font-weight:600;font-size:.8rem;">
                    Configurar Comisión
                </button>
            </td>
        </tr>`;
    }).join('');
}

async function loadGlobalSellerCommission() {
    // Eliminado: La comisión ahora es por membresía
}

async function saveGlobalSellerCommission() {
    // Eliminado: La comisión ahora es por membresía
}

function renderAdminsTable(admins) {
    const tbody = document.getElementById('adminsTableBody');
    if (!admins || admins.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-row"><p>No hay administradores registrados</p></td></tr>';
        return;
    }
    const permLabels = { courses:'📚 Cursos', memberships:'💎 Members', banners:'🖼️ Banners', users:'👥 Usuarios', categories:'📋 Categ.', logo:'🎨 Logo' };
    tbody.innerHTML = admins.map(a => {
        const perms = (a.permissions || []).map(p => permLabels[p] || p).join(', ') || '<span style="color:#4FFFB0;">Acceso Total</span>';
        return `
        <tr>
            <td><strong style="color:#fff;">${a.name}</strong> <span style="color:rgba(255,255,255,.5);font-size:.8rem;">${a.lastName || ''}</span></td>
            <td style="font-size:.85rem;color:#fff;">${a.email}</td>
            <td style="font-size:.8rem;color:#fff;">${perms}</td>
            <td>${a.canCreate !== false ? '<span style="color:#4FFFB0;">✔</span>' : '<span style="color:#FF6B70;">✘</span>'}</td>
            <td>${a.canEdit !== false ? '<span style="color:#4FFFB0;">✔</span>' : '<span style="color:#FF6B70;">✘</span>'}</td>
            <td>
                <div style="display:flex;gap:.4rem;">
                    <button onclick="openEditPermissionsModal('${a._id}','${a.name.replace(/'/g, "\\'") } ${a.lastName?.replace(/'/g, "\\'") || ''}','${a.role}','${(a.permissions||[]).join(',')}','${a.canCreate}','${a.canEdit}')"
                        title="Editar Permisos" style="padding:.35rem .6rem;background:rgba(255,165,0,.2);border:1px solid rgba(255,165,0,.4);color:#FFA500;border-radius:8px;cursor:pointer;">🔑</button>
                    <button onclick="openUserDetailsModal('${a._id}')"
                        title="Editar Perfil" style="padding:.35rem .6rem;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:8px;cursor:pointer;">📝</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderUsersPagination(totalUsers) {
    const paginationContainer = document.getElementById('usersPagination');
    if (!paginationContainer) return;
    const totalPages = Math.ceil(totalUsers / usersPerPage);
    if (totalPages <= 1) { paginationContainer.innerHTML = ''; return; }
    let html = `<button class="pagination-btn" onclick="changeUsersPage(${usersCurrentPage - 1})" ${usersCurrentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="pagination-btn ${usersCurrentPage === i ? 'active' : ''}" onclick="changeUsersPage(${i})">${i}</button>`;
    }
    html += `<button class="pagination-btn" onclick="changeUsersPage(${usersCurrentPage + 1})" ${usersCurrentPage === totalPages ? 'disabled' : ''}>&raquo;</button>`;
    paginationContainer.innerHTML = html;
}

function changeUsersPage(page) {
    usersCurrentPage = page;
    const q = document.getElementById('usersSearchInput')?.value || '';
    filterUsersTable(q);
    document.getElementById('section-users').scrollIntoView({ behavior: 'smooth' });
}

function handleUserFilterChange(val) {
    currentUserFilter = val;
    usersCurrentPage = 1;
    renderUsersTable(usersData.filter(u => u.role === 'user'));
}


async function openUserMembershipModal(userId, userName) {
    editingUserId = userId;
    document.getElementById('userModalName').textContent = userName;

    // Cargar planes
    const res = await fetch(apiUrl('/api/admin/memberships'), { headers: authHeaders() });
    const data = await res.json();
    const select = document.getElementById('userMembershipSelect');
    select.innerHTML = '<option value="">-- Sin membresía (revocar) --</option>';
    if (data.success) {
        data.memberships.filter(m => m.isActive).forEach(m => {
            const sym = m.currency === 'USD' ? '$' : 'S/';
            select.innerHTML += `<option value="${m._id}">${m.name} — ${sym} ${m.price} / ${getDurationLabel(m.durationDays)}</option>`;
        });
    }

    // Pre-seleccionar membresía actual
    const user = usersData.find(u => u._id === userId);
    if (user && user.activeMembership) {
        select.value = user.activeMembership;
    }

    document.getElementById('userMembershipModal').classList.add('active');
}

function closeUserMembershipModal() {
    document.getElementById('userMembershipModal').classList.remove('active');
    editingUserId = null;
}

async function assignUserMembership() {
    const membershipId = document.getElementById('userMembershipSelect').value;
    if (!membershipId) { revokeUserMembership(); return; }
    try {
        const res = await fetch(apiUrl(`/api/admin/users/${editingUserId}/membership`), {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ membershipId })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Membresía asignada exitosamente');
            closeUserMembershipModal();
            loadUsers();
        } else {
            showToast(data.message || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

async function revokeUserMembership() {
    if (!confirm('¿Revocar la membresía de este usuario?')) return;
    try {
        const res = await fetch(apiUrl(`/api/admin/users/${editingUserId}/membership`), {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'revoke' })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Membresía revocada');
            closeUserMembershipModal();
            loadUsers();
        } else {
            showToast(data.message || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// Los usuarios ahora se crean vía openCreateUserModal()

// ===================================
// SETTINGS ADMIN
// ===================================

async function loadSettings() {
    try {
        // Usamos ruta relativa directa (NO apiUrl) para garantizar que siempre
        // vaya a la función serverless de Vercel y no al BACKEND_URL (EC2)
        const res = await fetch('/api/admin/settings', { headers: authHeaders() });
        const data = await res.json();

        if (data.success && data.settings) {
            const s = data.settings;

            // Si el usuario ya guardó localmente, usar esos valores para el formulario
            // (evita que la BD desactualizada sobreescriba lo que el usuario acaba de cambiar)
            const effectiveName = lastSavedSettings ? lastSavedSettings.companyName : s.companyName;
            const effectiveLogo = lastSavedSettings ? lastSavedSettings.logoUrl : s.logoUrl;

            // Guardar en localStorage para persistencia al refrescar
            localStorage.setItem('branding_companyName', effectiveName || '');
            localStorage.setItem('branding_logoUrl', effectiveLogo || '');

            // Banner section (presentationVideoUrl siempre viene de la BD)
            if (document.getElementById('presentationVideoUrl')) {
                document.getElementById('presentationVideoUrl').value = s.presentationVideoUrl || '';
            }

            // Logo section
            if (document.getElementById('configCompanyName')) {
                document.getElementById('configCompanyName').value = effectiveName || 'IATIBET ZUREON';
                document.getElementById('configLogoUrl').value = effectiveLogo || '';

                const preview = document.getElementById('configLogoPreview');
                if (preview) {
                    preview.style.backgroundImage = effectiveLogo ? `url('${effectiveLogo}')` : '';
                }
            }

            // Sincronizar Header
            if (effectiveName) {
                const headerLogoText = document.querySelector('.header .logo-text');
                if (headerLogoText) headerLogoText.textContent = effectiveName;
            }
            if (effectiveLogo) {
                const headerLogoIcon = document.querySelector('.header .logo-icon');
                if (headerLogoIcon) {
                    headerLogoIcon.style.backgroundImage = `url('${effectiveLogo}')`;
                    headerLogoIcon.style.backgroundSize = 'cover';
                    headerLogoIcon.style.backgroundPosition = 'center';
                }
            }

            // Eliminar estilos temporales de marca temprana
            const earlyStyle = document.getElementById('early-branding-style');
            if (earlyStyle) earlyStyle.remove();

            settingsLoaded = true;
        }
    } catch (err) {
        console.error('Error loading settings', err);
    }
}

async function saveSettings(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const url = document.getElementById('presentationVideoUrl').value;

    btn.disabled = true;
    btn.innerHTML = 'Guardando...';

    try {
        const res = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ presentationVideoUrl: url })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Video de presentación guardado');
        } else {
            showToast(data.message || 'Error al guardar', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Link';
    }
}

// ===================================
// LOGO ADMIN
// ===================================

async function previewConfigLogo(input) {
    const preview = document.getElementById('configLogoPreview');
    const file = input.files[0];
    if (file) {
        if (file.size > 1 * 1024 * 1024) { // 1MB para el logo
            showToast('La imagen es demasiado grande. Máximo 1MB.', 'error');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            preview.style.backgroundImage = `url('${e.target.result}')`;
            document.getElementById('configLogoUrl').value = e.target.result;
            showToast('Logo cargado correctamente', 'info');
        };
        reader.readAsDataURL(file);
    }
}

async function saveLogoSettings(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const submitText = document.getElementById('logoSubmitText');
    const submitSpinner = document.getElementById('logoSubmitSpinner');

    submitBtn.disabled = true;
    submitText.style.display = 'none';
    submitSpinner.style.display = 'inline-block';

    const companyName = document.getElementById('configCompanyName').value;
    const logoUrl = document.getElementById('configLogoUrl').value;

    const payload = { companyName, logoUrl };

    try {
        // Ruta relativa directa: siempre va a la función serverless de Vercel,
        // nunca al BACKEND_URL (EC2) que puede no tener este endpoint
        const res = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });

        // Manejar errores de tamaño u otros errores del servidor
        if (res.status === 413) {
            showToast('La imagen es demasiado grande para el servidor.', 'error');
            return;
        }

        let data;
        try {
            data = await res.json();
        } catch (e) {
            showToast(`Error del servidor (${res.status}). Intenta con un logo más pequeño.`, 'error');
            return;
        }

        if (data.success) {
            showToast('Configuración de marca guardada correctamente');

            // Guardar localmente para que cambios de pestaña no reviertan el formulario
            lastSavedSettings = { companyName, logoUrl };
            localStorage.setItem('branding_companyName', companyName);
            localStorage.setItem('branding_logoUrl', logoUrl);

            // Actualizar el header en tiempo real
            const headerLogoText = document.querySelector('.header .logo-text');
            if (headerLogoText && companyName) headerLogoText.textContent = companyName;

            const headerLogoIcon = document.querySelector('.header .logo-icon');
            if (headerLogoIcon && logoUrl) {
                headerLogoIcon.style.backgroundImage = `url('${logoUrl}')`;
                headerLogoIcon.style.backgroundSize = 'cover';
                headerLogoIcon.style.backgroundPosition = 'center';
            }

            // Mantener los valores en el formulario
            document.getElementById('configCompanyName').value = companyName;
            document.getElementById('configLogoUrl').value = logoUrl;

            console.log('[SaveLogo] Saved successfully:', { companyName, logoUrlLength: logoUrl.length });
        } else {
            showToast(data.message || 'Error al guardar', 'error');
            console.error('[SaveLogo] Server error:', data);
        }
    } catch (err) {
        console.error('[SaveLogo] Network error:', err);
        showToast('Error de conexión al servidor.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitText.style.display = 'inline';
        submitSpinner.style.display = 'none';
    }
}

// ===================================
// BANNERS ADMIN
// ===================================
let bannersData = [];
let editingBannerId = null;

async function loadBanners() {
    try {
        const res = await fetch(apiUrl('/api/admin/banners'), { headers: authHeaders() });
        const data = await res.json();
        if (data.success) {
            bannersData = data.banners;
            renderBannersTable(data.banners);
        } else {
            showToast(data.message || 'Error al cargar banners', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

function renderBannersTable(banners) {
    const tbody = document.getElementById('bannersTableBody');
    if (!banners || banners.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-row"><p>No hay banners disponibles</p></td></tr>';
        return;
    }

    tbody.innerHTML = banners.map(b => `
        <tr>
            <td><img src="${b.imageUrl}" alt="Banner" style="width:120px;height:50px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,.1);"></td>
            <td><strong>${b.title || '-'}</strong></td>
            <td>${b.subtitle || '-'}</td>
            <td>${b.order}</td>
            <td>${b.isActive ? '<span class="badge" style="background:rgba(79,255,176,.2);color:#4FFFB0;">Activo</span>' : '<span class="badge" style="background:rgba(255,75,85,.2);color:#FF6B70;">Inactivo</span>'}</td>
            <td>
                <div class="table-actions-cell">
                    <button class="btn-icon btn-edit" onclick="editBanner('${b._id}')" title="Editar">✏️</button>
                    <button class="btn-icon btn-delete" onclick="deleteBanner('${b._id}')" title="Eliminar">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openBannerModal(id) {
    editingBannerId = id || null;
    document.getElementById('bannerModalTitle').textContent = id ? 'Editar Banner' : 'Nuevo Banner';
    document.getElementById('bannerForm').reset();
    document.getElementById('bannerId').value = '';
    document.getElementById('bannerImagePreview').innerHTML = '';
    document.getElementById('bannerImagePreview').classList.remove('active');
    document.getElementById('bannerImageUrl').value = '';
    document.getElementById('bannerActive').checked = true;

    if (id) {
        const banner = bannersData.find(b => b._id === id);
        if (banner) {
            document.getElementById('bannerId').value = banner._id;
            document.getElementById('bannerTitle').value = banner.title || '';
            document.getElementById('bannerSubtitle').value = banner.subtitle || '';
            document.getElementById('bannerLinkUrl').value = banner.linkUrl || '';
            document.getElementById('bannerOrder').value = banner.order || 1;
            document.getElementById('bannerImageUrl').value = banner.imageUrl || '';
            document.getElementById('bannerActive').checked = banner.isActive;

            if (banner.imageUrl) {
                const preview = document.getElementById('bannerImagePreview');
                preview.innerHTML = `<img src="${banner.imageUrl}" alt="Preview">`;
                preview.classList.add('active');
            }
        }
    } else {
        document.getElementById('bannerOrder').value = bannersData.length + 1;
    }

    document.getElementById('bannerModal').classList.add('active');
}

function closeBannerModal() {
    document.getElementById('bannerModal').classList.remove('active');
    editingBannerId = null;
}

async function previewBannerImage(input) {
    const preview = document.getElementById('bannerImagePreview');
    const file = input.files[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) {
            showToast('La imagen es demasiado grande. Máximo 2MB.', 'error');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            preview.classList.add('active');

            // Asignar base64 al URL del banner
            document.getElementById('bannerImageUrl').value = e.target.result;
            showToast('Imagen del banner cargada correctamente', 'info');
        };
        reader.readAsDataURL(file);
    }
}

async function saveBanner(e) {
    e.preventDefault();
    const submitBtnText = document.getElementById('bannerSubmitText');
    const submitSpinner = document.getElementById('bannerSubmitSpinner');
    const btn = e.target.querySelector('button[type="submit"]');

    btn.disabled = true;
    submitBtnText.style.display = 'none';
    submitSpinner.style.display = 'inline-block';

    const formData = {
        title: document.getElementById('bannerTitle').value,
        subtitle: document.getElementById('bannerSubtitle').value,
        linkUrl: document.getElementById('bannerLinkUrl').value,
        order: parseInt(document.getElementById('bannerOrder').value) || 0,
        imageUrl: document.getElementById('bannerImageUrl').value,
        isActive: document.getElementById('bannerActive').checked
    };

    if (!formData.imageUrl) {
        showToast('Debes subir una imagen para el banner', 'error');
        btn.disabled = false;
        submitBtnText.style.display = 'inline';
        submitSpinner.style.display = 'none';
        return;
    }

    try {
        const url = editingBannerId ? `/api/admin/banners/${editingBannerId}` : '/api/admin/banners';
        const method = editingBannerId ? 'PUT' : 'POST';

        const res = await fetch(apiUrl(url), {
            method,
            headers: authHeaders(),
            body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (data.success) {
            showToast(editingBannerId ? 'Banner actualizado' : 'Banner creado');
            closeBannerModal();
            loadBanners();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        submitBtnText.style.display = 'inline';
        submitSpinner.style.display = 'none';
    }
}

async function deleteBanner(id) {
    if (!confirm('¿Seguro que deseas eliminar este banner de forma permanente?')) return;
    try {
        const res = await fetch(apiUrl(`/api/admin/banners/${id}`), {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();
        if (data.success) {
            showToast('Banner eliminado');
            loadBanners();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

function editBanner(id) {
    openBannerModal(id);
}

// ===================================
// USER PROFILE & PASSWORD Reset
// ===================================

let currentEditingUserId = null;

async function openUserDetailsModal(userId) {
    currentEditingUserId = userId;
    document.getElementById('userDetailsModal').classList.add('active');
    document.getElementById('editUserForm').reset();
    document.getElementById('newAdminUserPassword').value = '';

    try {
        const res = await fetch(apiUrl('/api/admin/users'), { headers: authHeaders() });
        const data = await res.json();
        const user = data.users.find(u => u._id === userId);
        
        if (user) {
            document.getElementById('edName').value = user.name || '';
            document.getElementById('edLastName').value = user.lastName || '';
            document.getElementById('edEmail').value = user.email || '';
            document.getElementById('edPhone').value = user.phone || '';
            document.getElementById('edCountry').value = user.country || '';
        }
    } catch (err) {
        console.error('Error loading user data:', err);
    }
}

function closeUserDetailsModal() {
    document.getElementById('userDetailsModal').classList.remove('active');
    currentEditingUserId = null;
}

async function handleEditUserSubmit(e) {
    e.preventDefault();
    if (!currentEditingUserId) return;

    const btn = document.getElementById('btnUpdateUser');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const updateData = {
        name: document.getElementById('edName').value,
        lastName: document.getElementById('edLastName').value,
        email: document.getElementById('edEmail').value,
        phone: document.getElementById('edPhone').value,
        country: document.getElementById('edCountry').value
    };

    try {
        const res = await fetch(apiUrl(`/api/admin/users?id=${currentEditingUserId}`), {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify(updateData)
        });
        const data = await res.json();
        if (data.success) {
            showToast('Perfil actualizado correctamente');
            loadUsers();
        } else {
            showToast(data.message || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Cambios';
    }
}

async function updateUserPassword() {
    const newPassword = document.getElementById('newAdminUserPassword').value;
    if (!newPassword || newPassword.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }

    if (!confirm('¿Seguro que deseas cambiar la contraseña de este usuario?')) return;

    try {
        const res = await fetch(apiUrl(`/api/admin/users/${currentEditingUserId}`), {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ password: newPassword })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Contraseña actualizada con éxito');
            document.getElementById('newAdminUserPassword').value = '';
        } else {
            showToast(data.message || 'Error al actualizar', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// ===================================
// Initialize
// ===================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔧 Initializing Admin Panel...');
    await configReady;

    // Verificar autenticación de admin
    const token = adminToken();
    if (!token) {
        window.location.href = '/admin-login';
        return;
    }
    // Verificar rol y permisos
    const user = JSON.parse(localStorage.getItem('authUser') || '{}');
    if (user.role !== 'admin') {
        window.location.href = '/admin-login';
        return;
    }
    document.getElementById('adminUserName').textContent = `👤 ${user.name}`;

    // Aplicar permisos de vista si existen
    applyViewPermissions(user);

    // Modo tab inicial
    try {
        // Intentar abrir la primera tab permitida
        const firstTab = getFirstAllowedTab(user);
        switchTab(firstTab);
        
        if (firstTab === 'courses') fetchCourses();
        setupSearch();
    } catch (err) {
        console.error('Error during initial tab setup:', err);
    }
    
    const courseForm = document.getElementById('courseForm');
    if (courseForm) courseForm.addEventListener('submit', handleFormSubmit);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCourseModal();
            closeContentModal();
            closeMembershipModal();
            closeUserMembershipModal();
            closeUserDetailsModal();
            closeBannerModal();
            closeCategoryModal();
            closeCreateUserModal();
        }
    });

    document.getElementById('createUserModal')?.addEventListener('click', e => {
        if (e.target.id === 'createUserModal') closeCreateUserModal();
    });

    console.log('✅ Admin Panel initialized!');
});

// ===================================
// GESTIÓN DE PERMISOS Y USUARIOS
// ===================================

function applyViewPermissions(user) {
    if (!user.permissions || user.permissions.length === 0) return;
    const allTabs = ['courses', 'memberships', 'banners', 'users', 'categories', 'logo', 'commissions'];
    allTabs.forEach(tab => {
        const menuItem = document.getElementById(`tab-${tab}`);
        if (menuItem && !user.permissions.includes(tab)) {
            menuItem.style.display = 'none';
        }
    });
}

function getFirstAllowedTab(user) {
    if (!user.permissions || user.permissions.length === 0) return 'courses';
    const allTabs = ['courses', 'memberships', 'banners', 'users', 'categories', 'logo', 'commissions'];
    for (const tab of allTabs) {
        if (user.permissions.includes(tab)) return tab;
    }
    return 'courses';
}

function openCreateUserModal(role = 'user') {
    document.getElementById('createUserModal').classList.add('active');
    document.getElementById('createUserForm').reset();
    selectCreateRole(role);
}

function selectCreateRole(role) {
    // Update hidden input
    document.getElementById('ucRole').value = role;

    // Pill button styles
    const styles = {
        user:     { border:'rgba(79,255,176,.5)',  bg:'rgba(79,255,176,.12)',    color:'#4FFFB0' },
        vendedor: { border:'rgba(124,58,237,.5)', bg:'rgba(124,58,237,.18)',   color:'#c4b5fd' },
        admin:    { border:'rgba(79,70,229,.5)',  bg:'rgba(79,70,229,.18)',    color:'#818cf8' },
    };
    ['user', 'vendedor', 'admin'].forEach(r => {
        const btn = document.getElementById(`roleBtn-${r}`);
        if (r === role) {
            btn.style.border = `2px solid ${styles[r].border}`;
            btn.style.background = styles[r].bg;
            btn.style.color = styles[r].color;
        } else {
            btn.style.border = '2px solid rgba(255,255,255,.1)';
            btn.style.background = 'transparent';
            btn.style.color = 'rgba(255,255,255,.4)';
        }
    });

    // Show/hide exclusive blocks
    document.getElementById('ucSellerFields').style.display     = role === 'vendedor' ? 'block' : 'none';
    document.getElementById('ucPermissionsFields').style.display = role === 'admin'    ? 'block' : 'none';

    // Update modal title & subtitle
    const titles = { user: 'Nuevo Usuario', vendedor: 'Nuevo Vendedor', admin: 'Nuevo Administrador' };
    const subs   = {
        user:     'Datos básicos de cuenta de acceso a la plataforma',
        vendedor: 'El código de referido se autogenera si lo dejas vacío',
        admin:    'Define qué secciones del panel puede gestionar este admin',
    };
    document.getElementById('createUserModalTitle').textContent = titles[role];
    document.getElementById('createUserModalSub').textContent   = subs[role];

    // Save button label
    const btnLabels = { user: 'Crear Usuario', vendedor: 'Crear Vendedor', admin: 'Crear Admin' };
    document.getElementById('btnSaveUserText').textContent = btnLabels[role];
}


function closeCreateUserModal() {
    document.getElementById('createUserModal').classList.remove('active');
}

function togglePermissionsUI() {
    const role = document.getElementById('ucRole').value;
    const permSection = document.getElementById('ucPermissionsFields');
    const sellerSection = document.getElementById('ucSellerFields');
    
    // Solo mostrar permisos si es Admin (para restringirle vistas)
    permSection.style.display = (role === 'admin') ? 'block' : 'none';
    
    // Solo mostrar campos de vendedor si es Vendedor
    sellerSection.style.display = (role === 'vendedor') ? 'block' : 'none';
}

async function handleCreateUser(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSaveUser');
    const btnText = document.getElementById('btnSaveUserText');
    const btnSpinner = document.getElementById('btnSaveUserSpinner');
    btn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnSpinner) btnSpinner.style.display = 'inline-block';

    const role = document.getElementById('ucRole').value;
    const permissions = [];
    if (role === 'admin') {
        document.querySelectorAll('input[name="ucPerm"]:checked').forEach(cb => {
            permissions.push(cb.value);
        });
    }

    const userData = {
        name: document.getElementById('ucName').value,
        lastName: document.getElementById('ucLastName').value,
        email: document.getElementById('ucEmail').value,
        password: document.getElementById('ucPassword').value,
        role: role,
        permissions: permissions,
        canCreate: document.getElementById('ucCanCreate').checked,
        canEdit: document.getElementById('ucCanEdit').checked
    };

    if (role === 'vendedor') {
        userData.sellerCode = document.getElementById('ucSellerCode').value || undefined;
    }


    try {
        const res = await fetch(apiUrl('/api/admin/users'), {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(userData)
        });

        const data = await res.json();
        if (data.success) {
            if (role === 'vendedor' && data.sellerCode) {
                showToast(`✅ Vendedor creado — Código: ${data.sellerCode}`, 'success');
                // Mostrar alert para que el admin lo copie fácilmente
                setTimeout(() => alert(`✅ Vendedor creado exitosamente.\n\nCódigo de referido: ${data.sellerCode}\n\nGuarda este código para compartirlo con el vendedor.`), 500);
            } else {
                showToast('Usuario creado correctamente');
            }
            closeCreateUserModal();
            if (activeTab === 'users') {
                await loadUsers();
                switchUserSubTab(role);
            }
        } else {
            showToast(data.message || 'Error al crear usuario', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        if (btnText) { btnText.style.display = 'inline'; }
        if (btnSpinner) { btnSpinner.style.display = 'none'; }
    }
}

// EDITAR PERMISOS
let currentEditUserId = null;

function openEditPermissionsModal(userId, fullName, role, permissionsStr, canCreate, canEdit) {
    currentEditUserId = userId;
    document.getElementById('editPermissionsModal').classList.add('active');
    document.getElementById('epUserName').textContent = `Usuario: ${fullName}`;
    document.getElementById('epRole').value = role;
    
    // Reset checkboxes
    const perms = permissionsStr ? permissionsStr.split(',') : [];
    document.querySelectorAll('input[name="epPerm"]').forEach(cb => {
        cb.checked = perms.includes(cb.value);
    });

    document.getElementById('epCanCreate').checked = (canCreate === 'true' || canCreate === true);
    document.getElementById('epCanEdit').checked = (canEdit === 'true' || canEdit === true);
    
    toggleEditPermissionsUI();
}

function closeEditPermissionsModal() {
    document.getElementById('editPermissionsModal').classList.remove('active');
}

function toggleEditPermissionsUI() {
    const role = document.getElementById('epRole').value;
    document.getElementById('epPermissionsSection').style.display = (role === 'admin') ? 'block' : 'none';
}

async function savePermissionsChanges() {
    if (!currentEditUserId) return;
    
    const role = document.getElementById('epRole').value;
    const permissions = [];
    const canCreate = document.getElementById('epCanCreate').checked;
    const canEdit = document.getElementById('epCanEdit').checked;

    if (role === 'admin') {
        document.querySelectorAll('input[name="epPerm"]:checked').forEach(cb => {
            permissions.push(cb.value);
        });
    }

    try {
        const res = await fetch(apiUrl(`/api/admin/users?id=${currentEditUserId}`), {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ role, permissions, canCreate, canEdit })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Rol y permisos actualizados');
            closeEditPermissionsModal();
            loadUsers();
        } else {
            showToast(data.message || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// ===================================
// COMMISSIONS & WITHDRAWALS ADMIN
// ===================================

function switchCommSubTab(sub) {
    document.getElementById('comsub-all').style.display = sub === 'all' ? 'block' : 'none';
    document.getElementById('comsub-withdrawals').style.display = sub === 'withdrawals' ? 'block' : 'none';

    // Update buttons
    const btnAll = document.getElementById('csub-tab-all');
    const btnWith = document.getElementById('csub-tab-withdrawals');

    if (sub === 'all') {
        btnAll.style.background = 'rgba(79, 255, 176, 0.15)';
        btnAll.style.color = '#4FFFB0';
        btnWith.style.background = 'transparent';
        btnWith.style.color = 'rgba(255,255,255,0.5)';
        fetchAllTransactions();
    } else {
        btnWith.style.background = 'rgba(79, 255, 176, 0.15)';
        btnWith.style.color = '#4FFFB0';
        btnAll.style.background = 'transparent';
        btnAll.style.color = 'rgba(255,255,255,0.5)';
        fetchWithdrawalRequests();
    }
}

async function loadCommissionsData() {
    switchCommSubTab('all');
}

async function fetchAllTransactions() {
    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('authToken');
        const res = await fetch(apiUrl('/api/admin-users/transactions'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            renderCommissions(data.transactions);
        }
    } catch (err) {
        console.error('Error fetching transactions:', err);
    }
}

async function fetchWithdrawalRequests() {
    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('authToken');
        const res = await fetch(apiUrl('/api/admin-users/withdrawals'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            renderWithdrawalsAdmin(data.withdrawals);
        }
    } catch (err) {
        console.error('Error fetching withdrawals:', err);
    }
}

function renderCommissions(transactions) {
    const tbody = document.getElementById('commissionsTableBody');
    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; opacity:0.5;">No hay transacciones aún.</td></tr>';
        return;
    }

    tbody.innerHTML = transactions.map(t => {
        const sellerName = t.userId ? `${t.userId.name} ${t.userId.lastName || ''}` : 'Desconocido';
        const isComm = t.type === 'commission';
        const statusColor = (t.status === 'completed' || t.status === 'approved') ? '#4FFFB0' : (t.status === 'pending' ? '#F59E0B' : '#EF4444');
        return `
            <tr>
                <td style="font-size:0.85rem; opacity:0.6;">${new Date(t.createdAt).toLocaleString()}</td>
                <td style="font-weight:600;">${sellerName}</td>
                <td><span style="font-weight:800; color:${isComm ? '#4FFFB0' : '#3B82F6'};">${isComm ? 'COMISIÓN' : 'RETIRO'}</span></td>
                <td style="font-size:0.85rem;">${t.description}</td>
                <td style="font-weight:800; color:${isComm ? '#4FFFB0' : '#EF4444'};">${isComm ? '+' : '-'} S/ ${t.amount.toFixed(2)}</td>
                <td>
                    <span style="font-size:0.7rem; font-weight:800; padding:0.2rem 0.6rem; border-radius:4px; background:${statusColor}22; color:${statusColor}; border: 1px solid ${statusColor}44;">
                        ${t.status.toUpperCase()}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function renderWithdrawalsAdmin(withdrawals) {
    const tbody = document.getElementById('withdrawalsAdminTableBody');
    if (!withdrawals || withdrawals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; opacity:0.5;">No hay solicitudes de retiro.</td></tr>';
        return;
    }

    tbody.innerHTML = withdrawals.map(w => {
        const seller = w.userId || {};
        const sellerName = `${seller.name || '---'} ${seller.lastName || ''}`;
        const canProcess = w.status === 'pending';
        
        return `
            <tr>
                <td style="font-size:0.85rem; opacity:0.6;">${new Date(w.createdAt).toLocaleString()}</td>
                <td style="font-weight:700;">${sellerName}</td>
                <td style="font-size:0.85rem; opacity:0.7;">${seller.email || '---'}</td>
                <td style="font-weight:800; color:#EF4444;">S/ ${w.amount.toFixed(2)}</td>
                <td style="font-weight:600; color:#4FFFB0;">S/ ${(seller.sellerBalance || 0).toFixed(2)}</td>
                <td>
                    <span style="font-size:0.7rem; font-weight:800; padding:0.2rem 0.6rem; border-radius:4px; background:${w.status === 'pending' ? '#F59E0B' : (w.status === 'approved' ? '#4FFFB0' : '#EF4444')}22; color:${w.status === 'pending' ? '#F59E0B' : (w.status === 'approved' ? '#4FFFB0' : '#EF4444')};">
                        ${w.status.toUpperCase()}
                    </span>
                </td>
                <td>
                    ${canProcess ? `
                        <div style="display:flex; gap:0.5rem;">
                            <button onclick="processWithdrawal('${w._id}', 'approved')" class="btn-action edit" style="background:#4FFFB022; color:#4FFFB0; font-size:0.75rem; padding:0.4rem 0.8rem; border-radius:8px;">Aprobar</button>
                            <button onclick="processWithdrawal('${w._id}', 'rejected')" class="btn-action delete" style="background:#EF444422; color:#EF4444; font-size:0.75rem; padding:0.4rem 0.8rem; border-radius:8px;">Rechazar</button>
                        </div>
                    ` : '<span style="opacity:0.3; font-size:0.75rem;">PROCESADA</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

async function processWithdrawal(id, status) {
    if (!confirm(`¿Estás seguro de ${status === 'approved' ? 'APROBAR' : 'RECHAZAR'} este retiro?`)) return;

    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('authToken');
        const res = await fetch(apiUrl('/api/admin-users/withdrawals'), {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId: id, status })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Solicitud ${status === 'approved' ? 'aprobada' : 'rechazada'} correctamente`);
            fetchWithdrawalRequests();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Error al procesar retiro', 'error');
    }
}

function clearIconDataset(input, previewId) {
    if (input) delete input.dataset.iconUrl;
    const preview = document.getElementById(previewId);
    if (preview) {
        preview.style.backgroundImage = '';
        preview.textContent = '📷';
    }
}

// ===================================
// UNIVERSAL ICON UPLOAD (Base64)
// ===================================

function handleIconUpload(input, targetInputId, previewId) {
    const file = input.files[0];
    if (file) {
        if (file.size > 500 * 1024) { // 500KB is enough for a small icon
            showToast('El icono es demasiado grande. Máximo 500KB.', 'error');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            const target = document.getElementById(targetInputId);
            target.value = '🖼️ Imagen Cargada';
            target.dataset.iconUrl = base64;
            
            const preview = document.getElementById(previewId);

            if (preview) {
                preview.style.backgroundImage = `url('${base64}')`;
                preview.textContent = '';
            }
            showToast('Icono cargado', 'info');
        };
        reader.readAsDataURL(file);
    }
}

// ===================================
// LANDING CONFIG ADMIN
// ===================================

const DEFAULT_FEATURES = [
    { icon: "🎓", title: "Cursos ilimitados", description: "Accede a todos los cursos de la plataforma sin restricciones. Aprende a tu ritmo." },
    { icon: "📱", title: "Aprende donde quieras", description: "Acceso desde cualquier dispositivo. PC, tablet o celular. Siempre disponible 24/7." },
    { icon: "🏆", title: "Certificados verificados", description: "Al completar cada curso obtienes un certificado de logro que puedes compartir en LinkedIn." },
    { icon: "🔔", title: "Notificaciones de cursos", description: "Recibe alertas cuando se publiquen nuevos cursos según tus intereses y categorías favoritas." },
    { icon: "💬", title: "Comunidad exclusiva", description: "Únete a nuestra comunidad privada de miembros. Resuelve dudas y conecta con otros alumnos." },
    { icon: "⚡", title: "Contenido actualizado", description: "Los cursos se actualizan constantemente con el contenido más reciente de cada industria." }
];

const DEFAULT_HERO_TRUST_ITEMS = [
    'Cancela cuando quieras',
    'Certificados incluidos',
    'Acceso 24/7',
    'Garantía 7 días'
];

const DEFAULT_FAQS = [
    { question: "¿Puedo cancelar mi membresía en cualquier momento?", answer: "Sí, puedes cancelar en cualquier momento desde tu perfil. Mantendrás el acceso hasta que venza tu periodo activo. No hay contratos ni penalidades." },
    { question: "¿Cómo funciona la garantía de 7 días?", answer: "Si dentro de los primeros 7 días no estás satisfecho con tu membresía, te devolvemos el dinero sin preguntas. Contacta a nuestro equipo de soporte para gestionar tu reembolso." },
    { question: "¿Cuántos dispositivos puedo usar simultáneamente?", answer: "Puedes usar tu membresía en hasta 3 dispositivos al mismo tiempo. PC, tablet y celular. El acceso es personal e intransferible." },
    { question: "¿Hay algún costo adicional por cursos nuevos?", answer: "No. Tu membresía incluye acceso a todos los cursos presentes y futuros de la plataforma sin costo adicional. Siempre al mismo precio." },
    { question: "¿Cómo puedo pagar mi membresía?", answer: "Aceptamos Yape, Plin, transferencia bancaria y tarjetas de crédito/débito. El pago es procesado de forma segura. Una vez confirmado, el acceso se activa automáticamente." }
];

function switchLandingSubTab(sub, btn) {

    const sections = ['features', 'faq', 'guarantee'];
    sections.forEach(s => {
        const sec = document.getElementById(`landing-sub-${s}`);
        if (sec) sec.style.display = 'none';
    });
    const target = document.getElementById(`landing-sub-${sub}`);
    if (target) target.style.display = 'block';

    const buttons = btn.parentElement.querySelectorAll('.admin-tab');
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}


async function loadLandingConfig() {
    try {
        const res = await fetch(apiUrl('/api/landing-config'), { headers: authHeaders() });
        const data = await res.json();
        if (data.success && data.config) {
            const c = data.config;
            document.getElementById('heroTitleInput').value = c.heroTitle || '';
            document.getElementById('heroSubtitleInput').value = c.heroSubtitle || '';
            document.getElementById('featuresTitleInput').value = c.featuresTitle || '';
            document.getElementById('featuresSubtitleInput').value = c.featuresSubtitle || '';
            document.getElementById('faqTitleInput').value = c.faqTitle || '';
            document.getElementById('faqSubtitleInput').value = c.faqSubtitle || '';
            
            const gInput = document.getElementById('guaranteeIcon');
            if (c.guaranteeIcon && (c.guaranteeIcon.startsWith('http') || c.guaranteeIcon.startsWith('data:'))) {
                gInput.value = '🖼️ Imagen Cargada';
                gInput.dataset.iconUrl = c.guaranteeIcon;
            } else {
                gInput.value = c.guaranteeIcon || '';
                delete gInput.dataset.iconUrl;
            }

            const gPreview = document.getElementById('guaranteeIconPreview');
            if (gPreview && c.guaranteeIcon && (c.guaranteeIcon.startsWith('http') || c.guaranteeIcon.startsWith('data:'))) {
                gPreview.style.backgroundImage = `url('${c.guaranteeIcon}')`;
                gPreview.textContent = '';
            } else if (gPreview) {
                gPreview.style.backgroundImage = '';
                gPreview.textContent = '📷';
            }

            document.getElementById('guaranteeTitleInput').value = c.guaranteeTitle || 'Garantía de satisfacción de 7 días';
            document.getElementById('guaranteeDescriptionInput').value = c.guaranteeDescription || 'Prueba nuestra plataforma sin riesgo. Si dentro de los primeros 7 días no estás completamente satisfecho, te devolvemos el 100% de tu dinero. Sin preguntas, sin complicaciones.';

            renderAdminHeroTrustItems(c.heroTrustItems && c.heroTrustItems.length ? c.heroTrustItems : DEFAULT_HERO_TRUST_ITEMS);
            renderAdminFeatures(c.features && c.features.length ? c.features : DEFAULT_FEATURES);
            renderAdminFaq(c.faqs && c.faqs.length ? c.faqs : DEFAULT_FAQS);

        }
    } catch (err) {
        console.error(err);
        showToast('Error al cargar configuración de landing', 'error');
    }
}

function renderAdminHeroTrustItems(items) {
    const container = document.getElementById('adminHeroTrustItemsContainer');
    if (!container) return;
    container.innerHTML = '';
    items.forEach(i => addAdminHeroTrustItemRow(i));
}

function addAdminHeroTrustItemRow(text = '') {
    const container = document.getElementById('adminHeroTrustItemsContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'hero-trust-item-row';
    div.style.marginBottom = '.6rem';
    div.style.display = 'flex';
    div.style.gap = '.5rem';
    div.innerHTML = `
        <input type="text" class="hero-trust-item-input" value="${text || ''}" placeholder="Ej: Acceso 24/7" style="flex:1;">
        <button type="button" onclick="this.parentElement.remove()" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#ef4444;border-radius:8px;padding:0 .7rem;cursor:pointer;">×</button>
    `;
    container.appendChild(div);
}

function renderAdminFeatures(features) {
    const container = document.getElementById('adminFeaturesContainer');
    if(!container) return;
    container.innerHTML = '';
    features.forEach(f => addAdminFeatureRow(f));
}


function addAdminFeatureRow(data = {}) {
    const container = document.getElementById('adminFeaturesContainer');
    if(!container) return;
    const div = document.createElement('div');
    div.className = 'feature-card';
    div.style.marginBottom = '1.25rem';
    div.style.padding = '1.5rem';
    div.style.position = 'relative';
    div.style.background = 'rgba(0,0,0,0.2)';
    div.style.borderRadius = '14px';
    div.style.border = '1px solid rgba(255,255,255,0.08)';
    div.style.transition = 'all 0.3s ease';
    
    const rowId = Date.now() + Math.floor(Math.random() * 1000);
    div.innerHTML = `
        <button type="button" onclick="this.parentElement.remove()" style="position:absolute;top:0.75rem;right:0.75rem;background:rgba(239, 68, 68, 0.1);border:none;color:#ef4444;cursor:pointer;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:all 0.2s;">×</button>

        <div class="form-grid" style="display:grid; grid-template-columns: 1fr 2fr; gap: 1rem;">
            <div class="form-group">
                <label>Icono (Emoji o Imagen)</label>
                <div style="display:flex;gap:.5rem;align-items:center;">
                    <input type="text" class="feat-icon" id="featIcon-${rowId}" 
                        value="${data.icon && (data.icon.startsWith('http') || data.icon.startsWith('data:')) ? '🖼️ Imagen Cargada' : (data.icon || '')}" 
                        data-icon-url="${data.icon && (data.icon.startsWith('http') || data.icon.startsWith('data:')) ? data.icon : ''}"
                        placeholder="Ej: 🚀" style="flex:1;"
                        oninput="clearIconDataset(this, 'featIconPreview-${rowId}')">
                    <div style="position:relative;width:40px;height:40px;">

                        <input type="file" onchange="handleIconUpload(this, 'featIcon-${rowId}', 'featIconPreview-${rowId}')" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer;z-index:2;">
                        <div id="featIconPreview-${rowId}" style="width:40px;height:40px;border:1px dashed rgba(255,255,255,.2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;background-size:cover;background-position:center;">
                            ${data.icon && (data.icon.startsWith('http') || data.icon.startsWith('data:')) ? '' : '📷'}
                        </div>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Título del Beneficio</label>
                <input type="text" class="feat-title" value="${data.title || ''}" placeholder="Ej: Cursos ilimitados">
            </div>
        </div>
        <div class="form-group" style="margin-top:0.75rem;">
            <label>Descripción</label>
            <textarea class="feat-desc" rows="2" placeholder="Describe brevemente este beneficio...">${data.description || ''}</textarea>
        </div>
    `;
    container.appendChild(div);

    if (data.icon && (data.icon.startsWith('http') || data.icon.startsWith('data:'))) {
        const preview = document.getElementById(`featIconPreview-${rowId}`);
        if (preview) preview.style.backgroundImage = `url('${data.icon}')`;
    }
}

function renderAdminFaq(faqs) {
    const container = document.getElementById('adminFaqContainer');
    if(!container) return;
    container.innerHTML = '';
    faqs.forEach(f => addAdminFaqRow(f));
}


function addAdminFaqRow(data = {}) {
    const container = document.getElementById('adminFaqContainer');
    if(!container) return;
    const div = document.createElement('div');
    div.className = 'faq-card-admin';
    div.style.marginBottom = '1.25rem';
    div.style.padding = '1.5rem';
    div.style.position = 'relative';

    div.style.background = 'rgba(0,0,0,0.2)';
    div.style.borderRadius = '14px';
    div.style.border = '1px solid rgba(255,255,255,0.08)';
    
    div.innerHTML = `
        <button type="button" onclick="this.parentElement.remove()" style="position:absolute;top:0.75rem;right:0.75rem;background:rgba(239, 68, 68, 0.1);border:none;color:#ef4444;cursor:pointer;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:all 0.2s;">×</button>
        <div class="form-group">
            <label>Pregunta</label>
            <input type="text" class="faq-question" value="${data.question || ''}" placeholder="Ej: ¿Cómo accedo al contenido?">
        </div>
        <div class="form-group" style="margin-top:1rem;">
            <label>Respuesta</label>
            <textarea class="faq-answer" rows="3" placeholder="Ej: Una vez realices el pago...">${data.answer || ''}</textarea>
        </div>
    `;
    container.appendChild(div);
}

async function saveLandingConfig(e) {
    e.preventDefault();
    const btn = document.getElementById('landingSubmitText');
    const spinner = document.getElementById('landingSubmitSpinner');
    
    if(btn) btn.style.display = 'none';
    if(spinner) spinner.style.display = 'inline-block';

    const features = [];
    document.querySelectorAll('#adminFeaturesContainer .feature-card').forEach(row => {
        const iconInput = row.querySelector('.feat-icon');
        features.push({
            icon: iconInput.value === '🖼️ Imagen Cargada' ? iconInput.dataset.iconUrl : iconInput.value,
            title: row.querySelector('.feat-title').value,
            description: row.querySelector('.feat-desc').value
        });
    });

    const faqs = [];
    document.querySelectorAll('#adminFaqContainer .faq-card-admin').forEach(row => {
        const qInput = row.querySelector('.faq-question');
        const aInput = row.querySelector('.faq-answer');
        if (qInput && aInput) {
            faqs.push({
                question: qInput.value,
                answer: aInput.value
            });
        }
    });

    const heroTrustItems = [];
    document.querySelectorAll('#adminHeroTrustItemsContainer .hero-trust-item-input').forEach(input => {
        const val = (input.value || '').trim();
        if (val) heroTrustItems.push(val);
    });

    const gIconInput = document.getElementById('guaranteeIcon');
    const payload = {
        heroTitle: document.getElementById('heroTitleInput').value,
        heroSubtitle: document.getElementById('heroSubtitleInput').value,
        heroTrustItems,
        featuresTitle: document.getElementById('featuresTitleInput').value,
        featuresSubtitle: document.getElementById('featuresSubtitleInput').value,
        features,
        faqTitle: document.getElementById('faqTitleInput').value,
        faqSubtitle: document.getElementById('faqSubtitleInput').value,
        faqs,
        guaranteeIcon: gIconInput.dataset.iconUrl || gIconInput.value,
        guaranteeTitle: document.getElementById('guaranteeTitleInput').value,
        guaranteeDescription: document.getElementById('guaranteeDescriptionInput').value
    };

    try {
        const saveConfig = async (path) => {
            const res = await fetch(apiUrl(path), {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });

            let data = {};
            try {
                data = await res.json();
            } catch {
                data = { success: false, message: `Respuesta inválida (${res.status})` };
            }

            return { res, data };
        };

        let { res, data } = await saveConfig('/api/admin/landing-config');

        // Compatibilidad con despliegues donde no existe la ruta /api/admin/landing-config
        if (!data.success && (res.status === 404 || res.status === 405)) {
            ({ res, data } = await saveConfig('/api/landing-config'));
        }

        if (data.success) {
            showToast('Configuración guardada correctamente');
        } else {
            const errMsg = data.message || data.error || `Error al guardar (${res.status || 'sin estado'})`;
            showToast(errMsg, 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error de conexión', 'error');
    } finally {
        if(btn) btn.style.display = 'inline';
        if(spinner) spinner.style.display = 'none';
    }
}
