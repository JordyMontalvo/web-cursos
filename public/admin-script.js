// ===================================
// Admin Panel JavaScript
// ===================================

let allCourses = [];
let editingCourseId = null;
let currentContentCourseId = null; // ID del curso cuyo contenido se está editando

// ===================================
// API Functions
// ===================================

async function fetchCourses() {
    try {
        const response = await fetch(apiUrl('/api/courses'));
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📦 Cursos recibidos:', data);
        
        if (data.success) {
            // Asegurarnos de que cada curso tenga un ID válido
            allCourses = (data.courses || []).filter(c => {
                if (!c._id && !c.id) {
                    console.warn('⚠️ Curso ignorado por falta de ID:', c);
                    return false;
                }
                return true;
            });
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
        const response = await fetch(apiUrl(`/api/courses/${id}`, {
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
        const response = await fetch(apiUrl(`/api/courses/${id}`, {
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
        // Show local preview
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            preview.classList.add('active');
        };
        reader.readAsDataURL(file);
        
        // Upload image
        showToast('Subiendo imagen...', 'info');
        const imageUrl = await uploadImage(file);
        
        if (imageUrl) {
            document.getElementById('thumbnailUrl').value = imageUrl;
            showToast('Imagen subida exitosamente');
        }
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
        const response = await fetch(apiUrl(`/api/courses/${courseId}`);
        
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
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, description: newDesc })
        });
        if (response.ok) {
            showToast('Capítulo actualizado');
            openContentManager(currentContentCourseId);
            fetchCourses();
        } else {
            showToast('Error al actualizar', 'error');
        }
    } catch(err) {
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
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}/episodes/${episodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, videoUrl: newUrl })
        });
        if (response.ok) {
            showToast('Episodio actualizado');
            openContentManager(currentContentCourseId);
            fetchCourses();
        } else {
            showToast('Error al actualizar', 'error');
        }
    } catch(err) {
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
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters`, {
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
            // Actualizar lista principal en segundo plano
            fetchCourses();
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
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Capítulo eliminado');
            openContentManager(currentContentCourseId);
            fetchCourses();
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
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}/episodes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, videoUrl })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Episodio agregado');
            openContentManager(currentContentCourseId);
            fetchCourses();
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
        const response = await fetch(apiUrl(`/api/courses/${currentContentCourseId}/chapters/${chapterId}/episodes/${episodeId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Episodio eliminado');
            openContentManager(currentContentCourseId);
            fetchCourses();
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
// Close modal on outside click
// ===================================

document.getElementById('courseModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'courseModal') {
        closeCourseModal();
    }
});

document.getElementById('contentModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'contentModal') {
        closeContentModal();
    }
});

// ===================================
// Initialize
// ===================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔧 Initializing Admin Panel...');
    
    await configReady; // esperar URL del backend
    fetchCourses();
    
    // Setup search
    setupSearch();
    
    // Setup form
    document.getElementById('courseForm').addEventListener('submit', handleFormSubmit);
    
    // Setup keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // ESC to close modal
        if (e.key === 'Escape') {
            closeCourseModal();
            closeContentModal();
        }
    });
    
    console.log('✅ Admin Panel initialized!');
});
