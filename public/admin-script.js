// ===================================
// Admin Panel JavaScript
// ===================================

let allCourses = [];
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 segundos de caché
let editingCourseId = null;
let currentContentCourseId = null;

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
    const totalCourses = allCourses.length;
    const featuredCourses = allCourses.filter(c => c.featured).length;
    const categories = [...new Set(allCourses.map(c => c.category))].length;

    document.getElementById('totalCourses').textContent = totalCourses;
    document.getElementById('featuredCourses').textContent = featuredCourses;
    document.getElementById('totalCategories').textContent = categories;
}

// ===================================
// Modal Functions
// ===================================

function openAddCourseModal() {
    editingCourseId = null;
    document.getElementById('modalTitle').textContent = 'Nuevo Curso';
    document.getElementById('courseForm').reset();
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('imagePreview').classList.remove('active');
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
    document.getElementById('courseFeatured').checked = course.featured;

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
        featured: document.getElementById('courseFeatured').checked
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
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No hay capítulos creados aún.</p>';
        return;
    }

    // ... (renderChapters function)
    container.innerHTML = course.chapters.map((chapter, index) => `
        <div class="chapter-item ${index === 0 ? 'active' : ''}" id="chapter-${chapter._id}">
            <div class="chapter-header" onclick="toggleChapter(event, '${chapter._id}')">
                <div class="chapter-info">
                    <h3>${index + 1}. ${chapter.title}</h3>
                    ${chapter.description ? `<small style="color: #666;">${chapter.description}</small>` : ''}
                </div>
                <div class="chapter-actions">
                    <button class="btn-icon btn-edit btn-small" onclick="editChapter(event, '${chapter._id}', '${chapter.title}', '${chapter.description || ''}')" title="Editar Capítulo">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete btn-small" onclick="deleteChapter(event, '${chapter._id}')" title="Eliminar Capítulo">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="episodes-list">
                ${chapter.episodes && chapter.episodes.length > 0
            ? chapter.episodes.map((episode, epIndex) => `
                        <div class="episode-item">
                            <div class="episode-info">
                                <strong>Ep. ${epIndex + 1}:</strong> ${episode.title}
                                ${episode.duration ? `<small>(${episode.duration})</small>` : ''}
                            </div>
                            <div class="episode-actions">
                                <button class="btn-icon btn-edit btn-small" style="width: 28px; height: 28px;" onclick="editEpisode(event, '${chapter._id}', '${episode._id}', '${episode.title}', '${episode.videoUrl}')" title="Editar Episodio">
                                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                </button>
                                <button class="btn-icon btn-delete btn-small" style="width: 28px; height: 28px;" onclick="deleteEpisode(event, '${chapter._id}', '${episode._id}')" title="Eliminar Episodio">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `).join('')
            : '<p style="font-size: 0.85rem; color: #999; padding: 0.5rem; text-align: center;">No hay episodios.</p>'
        }
                
                <div class="add-episode-form" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed #eee;">
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <input type="text" placeholder="Título Episodio" id="ep-title-${chapter._id}" style="flex: 1; padding: 0.4rem; border: 1px solid #ddd; border-radius: 4px;">
                        <input type="text" placeholder="URL Video" id="ep-url-${chapter._id}" style="flex: 1; padding: 0.4rem; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <button class="btn-primary btn-small" onclick="addEpisode('${chapter._id}')" style="width: 100%;">+ Añadir Episodio</button>
                </div>
            </div>
        </div>
    `).join('');
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

async function editEpisode(e, chapterId, episodeId, currentTitle, currentUrl) {
    if (e) e.stopPropagation();
    const newTitle = prompt('Nuevo título del episodio:', currentTitle);
    if (newTitle === null) return;
    const newUrl = prompt('Nueva URL del video:', currentUrl);
    if (newUrl === null) return;

    try {
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}/episodes/${episodeId}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, videoUrl: newUrl })
        });
        if (response.ok) {
            showToast('Episodio actualizado');
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

function toggleChapter(e, chapterId) {
    // Si se hace click en acciones, no hacer nada
    if (e.target.closest('.chapter-actions') || e.target.closest('.add-episode-form') || e.target.closest('.episode-actions')) return;

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
    const titleInput = document.getElementById(`ep-title-${chapterId}`);
    const urlInput = document.getElementById(`ep-url-${chapterId}`);

    const title = titleInput.value;
    const videoUrl = urlInput.value;

    if (!title || !videoUrl) {
        showToast('Título y URL son obligatorios', 'error');
        return;
    }

    try {
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}/episodes`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, videoUrl })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Episodio agregado');
            openContentManager(currentContentCourseId);
            // fetchCourses(); // Eliminado redundante
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Error al agregar episodio', 'error');
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

function switchTab(tab) {
    ['courses', 'memberships', 'banners', 'users', 'logo'].forEach(t => {
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

    if (tab === 'memberships') loadMemberships();
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
        } else {
            showToast(data.message || 'Error al cargar planes', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

function getDurationLabel(days) {
    if (days === 0) return 'De por vida';
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
    document.getElementById('membColor').value = '#7C3AED';
    document.getElementById('membActive').checked = true;
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
            document.getElementById('membColor').value = plan.color || '#7C3AED';
            document.getElementById('membActive').checked = plan.isActive;

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

    const payload = {
        name: document.getElementById('membName').value,
        price: document.getElementById('membPrice').value,
        currency: document.getElementById('membCurrency').value,
        durationDays: document.getElementById('membDuration').value,
        badge: document.getElementById('membBadge').value,
        description: document.getElementById('membDesc').value,
        color: document.getElementById('membColor').value,
        isActive: document.getElementById('membActive').checked,
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

async function loadUsers() {
    try {
        const res = await fetch(apiUrl('/api/admin/users'), { headers: authHeaders() });
        const data = await res.json();
        if (data.success) {
            usersData = data.users;
            renderUsersTable(data.users);
        } else {
            showToast(data.message || 'Error', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-row"><p>No hay usuarios registrados</p></td></tr>';
        return;
    }
    const now = new Date();

    // Filtramos según el estado seleccionado
    const filteredUsers = users.filter(u => {
        const isActive = u.membershipExpiresAt && new Date(u.membershipExpiresAt) > now;
        if (currentUserFilter === 'active') return isActive;
        if (currentUserFilter === 'inactive') return !isActive;
        return true;
    });

    if (filteredUsers.length === 0) {
        const msg = currentUserFilter === 'active' ? 'No hay usuarios activos' : 'No hay usuarios inactivos';
        tbody.innerHTML = `<tr><td colspan="6" class="loading-row"><p>${msg}</p></td></tr>`;
        return;
    }

    tbody.innerHTML = filteredUsers.map(u => {
        const isActive = u.membershipExpiresAt && new Date(u.membershipExpiresAt) > now;
        const expDate = u.membershipExpiresAt ? new Date(u.membershipExpiresAt).toLocaleDateString('es-PE') : '-';
        return `
        <tr>
            <td><strong>${u.name}</strong> ${u.lastName || ''}</td>
            <td style="font-size:.875rem;color:#1a1a1a;">${u.email}</td>
            <td>${u.role === 'admin' ? '<span style="background:rgba(255,215,0,.15);color:#FFD700;font-size:.75rem;font-weight:700;padding:.2rem .6rem;border-radius:100px;">ADMIN</span>' : '<span style="background:rgba(0,0,0,0.05);color:#1a1a1a;font-size:.75rem;padding:.2rem .6rem;border-radius:100px;">Usuario</span>'}</td>
            <td>${isActive ? `<span style="background:rgba(79,255,176,.1);color:#1a1a1a;font-size:.75rem;font-weight:700;padding:.2rem .6rem;border-radius:100px;">${u.membershipPlan || 'Activa'}</span>` : '<span style="color:#666;font-size:.85rem;">Sin membresía</span>'}</td>
            <td style="font-size:.8rem;color:#1a1a1a;">${isActive ? expDate : '-'}</td>
            <td>
                <button onclick="openUserMembershipModal('${u._id}','${u.name.replace(/'/g, "\\'")}')" style="padding:.45rem .9rem;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);color:#7C3AED;border-radius:8px;cursor:pointer;font-size:.8rem;font-family:inherit;">
                    💎 Membresía
                </button>
            </td>
        </tr>`;
    }).join('');
}

function handleUserFilterChange(val) {
    currentUserFilter = val;
    renderUsersTable(usersData);
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
    // Verificar rol
    const user = JSON.parse(localStorage.getItem('authUser') || '{}');
    if (user.role !== 'admin') {
        window.location.href = '/admin-login';
        return;
    }
    document.getElementById('adminUserName').textContent = `👤 ${user.name}`;

    // Modo tab inicial
    switchTab('courses');
    fetchCourses();
    setupSearch();
    document.getElementById('courseForm').addEventListener('submit', handleFormSubmit);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCourseModal();
            closeContentModal();
            closeMembershipModal();
            closeUserMembershipModal();
            closeBannerModal();
        }
    });

    // Close modals on outside click
    document.getElementById('membershipModal')?.addEventListener('click', e => {
        if (e.target.id === 'membershipModal') closeMembershipModal();
    });
    document.getElementById('userMembershipModal')?.addEventListener('click', e => {
        if (e.target.id === 'userMembershipModal') closeUserMembershipModal();
    });
    document.getElementById('bannerModal')?.addEventListener('click', e => {
        if (e.target.id === 'bannerModal') closeBannerModal();
    });

    console.log('✅ Admin Panel initialized!');
});

