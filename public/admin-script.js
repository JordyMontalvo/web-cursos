// ===================================
// Admin Panel JavaScript
// ===================================

let allCourses = [];
let editingCourseId = null;

// ===================================
// API Functions
// ===================================

async function fetchCourses() {
    try {
        const response = await fetch('/api/courses');
        const data = await response.json();
        
        if (data.success) {
            allCourses = data.courses;
            renderCoursesTable(allCourses);
            updateStats();
        }
    } catch (error) {
        console.error('Error fetching courses:', error);
        showToast('Error al cargar los cursos', 'error');
    }
}

async function createCourse(courseData) {
    try {
        const response = await fetch('/api/courses', {
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
        const response = await fetch(`/api/courses/${id}`, {
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
        const response = await fetch(`/api/courses/${id}`, {
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
        const response = await fetch('/api/upload', {
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
    
    tbody.innerHTML = courses.map(course => `
        <tr>
            <td><strong>#${course.id}</strong></td>
            <td>
                <img src="${course.thumbnail}" alt="${course.name}" class="thumbnail-cell" onerror="this.src='/uploads/default-course.jpg'">
            </td>
            <td><strong>${course.name}</strong></td>
            <td><span class="badge">${course.category}</span></td>
            <td>${course.chapters}</td>
            <td>${course.episodes}</td>
            <td>
                ${course.featured 
                    ? '<span class="featured-badge"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.545 4.13L11 4.635L8.5 7.07L9.09 10.51L6 8.885L2.91 10.51L3.5 7.07L1 4.635L4.455 4.13L6 1Z" fill="currentColor"/></svg> Destacado</span>' 
                    : '<span class="not-featured">No</span>'}
            </td>
            <td>
                <div class="table-actions-cell">
                    <button class="btn-icon btn-edit" onclick="editCourse(${course.id})" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M11.333 2.00004C11.5081 1.82494 11.716 1.68605 11.9447 1.59129C12.1735 1.49653 12.4187 1.44775 12.6663 1.44775C12.914 1.44775 13.1592 1.49653 13.3879 1.59129C13.6167 1.68605 13.8246 1.82494 13.9997 2.00004C14.1748 2.17513 14.3137 2.383 14.4084 2.61178C14.5032 2.84055 14.552 3.08575 14.552 3.33337C14.552 3.58099 14.5032 3.82619 14.4084 4.05497C14.3137 4.28374 14.1748 4.49161 13.9997 4.66671L5.33301 13.3334L1.33301 14.6667L2.66634 10.6667L11.333 2.00004Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteCourse(${course.id}, '${course.name.replace(/'/g, "\\'")}')">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2 4H3.33333H14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M5.33301 4.00004V2.66671C5.33301 2.31309 5.47348 1.97395 5.72353 1.7239C5.97358 1.47385 6.31272 1.33337 6.66634 1.33337H9.33301C9.68663 1.33337 10.0258 1.47385 10.2758 1.7239C10.5259 1.97395 10.6663 2.31309 10.6663 2.66671V4.00004M12.6663 4.00004V13.3334C12.6663 13.687 12.5259 14.0261 12.2758 14.2762C12.0258 14.5262 11.6866 14.6667 11.333 14.6667H4.66634C4.31272 14.6667 3.97358 14.5262 3.72353 14.2762C3.47348 14.0261 3.33301 13.687 3.33301 13.3334V4.00004H12.6663Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
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
    const course = allCourses.find(c => c.id === id);
    if (!course) return;
    
    editingCourseId = id;
    document.getElementById('modalTitle').textContent = 'Editar Curso';
    
    // Fill form
    document.getElementById('courseId').value = course.id;
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseCategory').value = course.category;
    document.getElementById('courseChapters').value = course.chapters;
    document.getElementById('courseEpisodes').value = course.episodes;
    document.getElementById('courseDescription').value = course.description || '';
    document.getElementById('courseVideoUrl').value = course.videoUrl || '';
    document.getElementById('thumbnailUrl').value = course.thumbnail || '';
    document.getElementById('courseFeatured').checked = course.featured;
    
    // Show thumbnail preview
    if (course.thumbnail) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${course.thumbnail}" alt="Preview">`;
        preview.classList.add('active');
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
        chapters: parseInt(document.getElementById('courseChapters').value),
        episodes: parseInt(document.getElementById('courseEpisodes').value),
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
// Search/Filter
// ===================================

function setupSearch() {
    const searchInput = document.getElementById('searchTable');
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        const filtered = allCourses.filter(course => 
            course.name.toLowerCase().includes(searchTerm) ||
            course.category.toLowerCase().includes(searchTerm) ||
            course.id.toString().includes(searchTerm)
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

// ===================================
// Initialize
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Initializing Admin Panel...');
    
    // Fetch courses
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
        }
    });
    
    console.log('✅ Admin Panel initialized!');
});
