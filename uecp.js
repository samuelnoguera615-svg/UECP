'use strict';

const AppController = (() => {
    let api;
    let currentUser = null;
    let sectionsList = [];
    let currentTeacherSection = null;
    let toastTimeout = null;

    const docentesBD = {
        bachillerato: [
            { area: 'Edu. Física', cantidad: 2 }, { area: 'Matemáticas', cantidad: 3 },
            { area: 'Física', cantidad: 3 }, { area: 'UCODE', cantidad: 3 },
            { area: 'Finanzas', cantidad: 4 }, { area: 'Biología', cantidad: 3 },
            { area: 'Inglés', cantidad: 3 }, { area: 'Ciencias de la Tierra', cantidad: 1 },
            { area: 'Ciencias Naturales', cantidad: 1 }, { area: 'Castellano', cantidad: 2 },
            { area: 'Orientación y Convivencia', cantidad: 2 }, { area: 'Soberanía', cantidad: 1 },
            { area: 'GHC', cantidad: 2 }
        ],
        primaria: [
            { area: 'Edu. Física', cantidad: 1 }, { area: 'Matemáticas', cantidad: 1 },
            { area: 'Castellano', cantidad: 1 }, { area: 'Inglés', cantidad: 1 },
            { area: 'Historia', cantidad: 1 }, { area: 'Manualidades', cantidad: 1 }
        ],
        preescolar: [
            { area: 'Motricidad y Juegos', cantidad: 1 }, { area: 'Iniciación a la Lectura', cantidad: 1 },
            { area: 'Arte y CreatSividad', cantidad: 1 }
        ]
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('show');
        });
    }, { threshold: 0.1 });

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getLoginMessage() {
        return document.getElementById('login-message');
    }

    function setLoginMessage(text, type = 'error') {
        const msg = getLoginMessage();
        if (!msg) return;
        msg.innerText = text;
        msg.style.color = type === 'success' ? 'green' : type === 'info' ? '#0b5160' : 'red';
    }

    function showToast(message, type = 'info') {
        const toast = document.getElementById('app-toast');
        if (!toast) return;
        toast.className = `app-toast show ${type}`;
        toast.textContent = message;

        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.className = 'app-toast';
        }, 2600);
    }

    function getSectionsByYear(sections) {
        return sections.reduce((acc, section) => {
            const year = section.year || 'Sin Año';
            if (!acc[year]) acc[year] = [];
            acc[year].push(section);
            return acc;
        }, {});
    }

    function getSelectedValues(selectId) {
        return Array.from(document.getElementById(selectId).selectedOptions).map(option => option.value);
    }

    function renderTeacherTableRows(students) {
        return students.map(student => `
            <tr class="${student.blocked ? 'row-blocked' : ''}">
                <td>${escapeHtml(student.listNumber || '-')}</td>
                <td>${escapeHtml(student.name)}</td>
                <td>
                    <input
                        type="number"
                        class="table-grade-input"
                        min="0"
                        max="20"
                        step="0.01"
                        value="${student.grade ?? ''}"
                        data-student-id="${student.studentId}"
                        data-student-name="${escapeHtml(student.name)}"
                        ${student.blocked ? 'disabled' : ''}
                    >
                </td>
                <td>
                    <input
                        type="text"
                        class="table-period-input"
                        value="${escapeHtml(student.period || '1')}"
                        data-student-id="${student.studentId}"
                        ${student.blocked ? 'disabled' : ''}
                    >
                </td>
                <td>${student.blocked ? 'Bloqueado' : 'Editable'}</td>
            </tr>
        `).join('');
    }

    function renderTeacherTableRowsWithEvaluations(students, subject, evaluationCount) {
        return students.map(student => {
            const subjectData = student.subjects[subject.toLowerCase()] || { grades: [], definitive: '0.00' };
            const grades = subjectData.grades || [];
            
            return `
                <tr class="${student.blocked ? 'row-blocked' : ''}">
                    <td>${escapeHtml(student.listNumber || '-')}</td>
                    <td>${escapeHtml(student.name)}</td>
                    ${Array.from({length: evaluationCount}, (_, i) => `
                        <td>
                            <input
                                type="number"
                                class="table-grade-input"
                                min="0"
                                max="20"
                                step="0.01"
                                value="${grades[i] || ''}"
                                data-student-id="${student.id}"
                                data-student-name="${escapeHtml(student.name)}"
                                data-period="${i + 1}"
                                ${student.blocked ? 'disabled' : ''}
                            >
                        </td>
                    `).join('')}
                    <td><strong>${subjectData.definitive}</strong></td>
                    <td>${student.blocked ? 'Bloqueado' : 'Editable'}</td>
                </tr>
            `;
        }).join('');
    }

    const UI = {
        showView(targetId, mainSections, subSections) {
            if (!targetId) targetId = 'inicio';

            mainSections.forEach(sec => {
                if (targetId === 'inicio') {
                    if (subSections.includes(sec.id)) {
                        sec.style.display = 'none';
                        sec.classList.add('hidden');
                    } else {
                        sec.style.display = '';
                        sec.classList.remove('hidden');
                        sec.classList.add('show');
                    }
                } else {
                    if (sec.id === targetId || sec.id === 'contacto') {
                        sec.style.display = '';
                        sec.classList.remove('hidden');
                        sec.classList.add('show');
                    } else {
                        sec.style.display = 'none';
                        sec.classList.add('hidden');
                    }
                }
            });
        },

        renderDocentes(nivel, gridId, containerId) {
            const grid = document.getElementById(gridId);
            if (!grid) return;

            const tabBtns = Array.from(document.querySelectorAll(`#${containerId} .tab-btn`));
            tabBtns.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.nivel === nivel) btn.classList.add('active');
            });

            grid.innerHTML = '';
            (docentesBD[nivel] || []).forEach(materia => {
                for (let i = 1; i <= materia.cantidad; i++) {
                    const card = document.createElement('div');
                    card.className = 'docente-card';
                    card.innerHTML = `<div class="docente-foto">[Foto]</div><h4>Docente ${i}</h4><p>${materia.area}</p>`;
                    grid.appendChild(card);
                }
            });
        },

        openDoc(url) {
            const iframe = document.getElementById('doc-iframe');
            if (!iframe) return;
            iframe.src = `${url}#toolbar=0`;
            document.getElementById('doc-viewer').classList.remove('hidden');
        },

        closeDocViewer() {
            document.getElementById('doc-viewer').classList.add('hidden');
            const iframe = document.getElementById('doc-iframe');
            if (iframe) iframe.src = '';
        }
    };

    async function handleAdminLogin() {
        const user = document.getElementById('admin-user').value.trim();
        const pass = document.getElementById('admin-pass').value.trim();

        try {
            const userData = await api.login(user, pass);
            if (userData.role !== 'admin') {
                setLoginMessage('Acceso denegado.');
                return;
            }
            currentUser = userData;
            showPanel('admin');
            setLoginMessage('', 'info');
            showToast('Sesión administrativa iniciada', 'success');
        } catch (e) {
            setLoginMessage(`Error: ${e.message}`);
        }
    }

    async function handleTeacherLogin() {
        const code = document.getElementById('teacher-codigo').value.trim();
        if (!code) return;

        try {
            const userData = await api.loginTeacher(code);
            currentUser = userData;
            showPanel('teacher');
            document.getElementById('teacher-welcome').innerText = `Bienvenido, ${userData.name}. Materia asignada: ${userData.subject || 'Sin materia'}`;
            verMisSeccionesDocente();
            setLoginMessage('', 'info');
            showToast('Sesión docente iniciada', 'success');
        } catch (e) {
            setLoginMessage(`Error: ${e.message}`);
        }
    }

    async function handleStudentLogin() {
        const sectionCode = document.getElementById('student-section-code').value.trim();
        const studentCode = document.getElementById('student-student-code').value.trim();

        if (!sectionCode || !studentCode) return;

        try {
            const studentData = await api.loginStudent(sectionCode, studentCode);
            currentUser = studentData;
            showPanel('student');
            document.getElementById('student-welcome').innerText = `Hola, ${studentData.name}`;
            loadStudentView();
            setLoginMessage('', 'info');
            showToast('Acceso a notas habilitado', 'success');
        } catch (e) {
            setLoginMessage(`Error: ${e.message}`);
        }
    }

    function showPanel(type) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('registro-content').classList.remove('hidden');
        document.querySelectorAll('.admin-panel, .teacher-panel, .student-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById(`${type}-panel`).classList.remove('hidden');
    }

    function logout() {
        currentUser = null;
        currentTeacherSection = null;
        api.clearToken();
        document.getElementById('registro-content').classList.add('hidden');
        document.getElementById('login-section').classList.remove('hidden');
        setLoginMessage('Sesión cerrada.', 'info');
        showToast('Sesión cerrada', 'info');
    }

    async function verTodasLasSecciones() {
        const content = document.getElementById('admin-content');
        content.classList.remove('hidden');
        content.innerHTML = '<p>Cargando secciones...</p>';

        try {
            const sections = await api.getSections();
            sectionsList = sections;
            const sectionsByYear = getSectionsByYear(sections);

            content.innerHTML = `
                <h4>Gestión de Secciones</h4>
                <div class="panel-card form-panel">
                    <h5>Nueva sección</h5>
                    <form id="section-form" class="grid-form compact-form">
                        <input type="text" id="section-name" placeholder="Nombre de la sección" required>
                        <select id="section-level" required>
                            <option value="">Nivel</option>
                            <option value="Preescolar">Preescolar</option>
                            <option value="Primaria">Primaria</option>
                            <option value="Bachillerato">Bachillerato</option>
                        </select>
                        <input type="text" id="section-year" placeholder="Año escolar" required>
                        <input type="text" id="section-code" placeholder="Código único del salón" required>
                        <button type="submit"><i class="fas fa-folder-plus"></i> Guardar sección</button>
                    </form>
                </div>
                <div class="folders-container">
                    ${Object.keys(sectionsByYear).sort().map(year => `
                        <div class="year-group">
                            <h5>Año Escolar: ${escapeHtml(year)}</h5>
                            <div class="sections-grid sections-grid-wide">
                                ${sectionsByYear[year].map(s => `
                                    <div class="folder-item admin-folder card-folder" data-id="${s.id}" data-name="${escapeHtml(s.name)}">
                                        <i class="fas fa-folder fa-3x"></i>
                                        <span>${escapeHtml(s.name)}</span>
                                        <small>Nivel: ${escapeHtml(s.level || '-')}</small>
                                        <small>Código: ${escapeHtml(s.section_code || '')}</small>
                                        <div class="folder-actions">
                                            <button type="button" class="btn-eliminar-seccion" data-id="${s.id}"><i class="fas fa-trash"></i></button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div id="folder-content-view" class="folder-content-view hidden"></div>
            `;

            document.getElementById('section-form').addEventListener('submit', submitNuevaSeccion);
            content.querySelectorAll('.admin-folder').forEach(item => {
                item.addEventListener('click', () => abrirCarpetaSeccion(item.dataset.id, item.dataset.name));
            });
            content.querySelectorAll('.btn-eliminar-seccion').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    eliminarSeccion(btn.dataset.id);
                });
            });
        } catch (e) {
            content.innerHTML = `<p class="error">Error: ${escapeHtml(e.message)}</p>`;
        }
    }

    async function submitNuevaSeccion(event) {
        event.preventDefault();
        const name = document.getElementById('section-name').value.trim();
        const level = document.getElementById('section-level').value.trim();
        const year = document.getElementById('section-year').value.trim();
        const sectionCode = document.getElementById('section-code').value.trim().toUpperCase();

        try {
            await api.createSection(name, level, year, sectionCode);
            showToast('Sección creada correctamente', 'success');
            verTodasLasSecciones();
        } catch (e) {
            showToast(`Error: ${e.message}`, 'error');
        }
    }

    async function eliminarSeccion(id) {
        if (!confirm('¿Eliminar esta sección y todos sus datos?')) return;
        try {
            await api.deleteSection(id);
            showToast('Sección eliminada', 'success');
            verTodasLasSecciones();
        } catch (e) {
            showToast(`Error: ${e.message}`, 'error');
        }
    }

    async function abrirCarpetaSeccion(id, name) {
        const view = document.getElementById('folder-content-view');
        view.classList.remove('hidden');
        view.innerHTML = '<p>Abriendo...</p>';

        try {
            const [result, students] = await Promise.all([
                api.getSectionFiles(id),
                api.getStudentsInSection(id)
            ]);
            const files = result.files || [];
            const section = result.section || { name };
            view.innerHTML = `
                <div class="folder-header">
                    <div>
                        <h5><i class="fas fa-folder-open"></i> Carpeta: ${escapeHtml(section.name || name)}</h5>
                        <p class="folder-meta">Código del salón: <strong>${escapeHtml(section.sectionCode || '')}</strong></p>
                    </div>
                    <button class="btn-close-folder">Cerrar</button>
                </div>
                <div class="dashboard-two-columns">
                    <div class="panel-card">
                        <h6>Archivos por materia</h6>
                        <div class="files-grid compact-grid">
                            ${files.length > 0 ? files.map(f => `
                                <div class="file-item admin-file">
                                    <i class="fas fa-file-alt fa-2x"></i>
                                    <span class="file-name">${escapeHtml(f.subject)}</span>
                                    <span class="file-date">${escapeHtml(f.date)}</span>
                                </div>
                            `).join('') : '<p>Sin archivos de materias todavía.</p>'}
                        </div>
                    </div>
                    <div class="panel-card">
                        <h6>Estudiantes de la sección</h6>
                        <table class="grades-table compact-table">
                            <thead>
                                <tr>
                                    <th>N° Lista</th>
                                    <th>Nombre</th>
                                    <th>Código</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${students.map(student => `
                                    <tr class="${student.blocked ? 'row-blocked' : ''}">
                                        <td>${escapeHtml(student.list_number || '-')}</td>
                                        <td>${escapeHtml(student.name)}</td>
                                        <td>${escapeHtml(student.student_code || '-')}</td>
                                        <td>${student.blocked ? 'Baneado' : 'Activo'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            view.querySelector('.btn-close-folder').addEventListener('click', () => view.classList.add('hidden'));
        } catch (e) {
            view.innerHTML = `<p class="error">Error: ${escapeHtml(e.message)}</p>`;
        }
    }

    async function configurarEvaluacionesAdmin() {
        const content = document.getElementById('admin-content');
        content.classList.remove('hidden');
        content.innerHTML = '<p>Cargando...</p>';

        try {
            const sections = await api.getSections();
            const evalConfigs = await Promise.all(
                sections.map(async section => {
                    const configs = await api.getSectionEvaluations(section.id);
                    return { section, configs };
                })
            );

            content.innerHTML = `
                <div class="panel-card">
                    <h4>Configurar Evaluaciones por Sección y Materia</h4>
                    <p>Configure si cada materia tendrá 3 o 4 evaluaciones por año.</p>
                    <div class="evaluations-config-grid">
                        ${sections.map(section => `
                            <div class="section-eval-config">
                                <h5><i class="fas fa-folder"></i> ${escapeHtml(section.name)} (${escapeHtml(section.section_code)})</h5>
                                <div class="subjects-config">
                                    ${['Matemáticas', 'Castellano', 'Historia', 'Geografía', 'Ciencias', 'Inglés', 'Educación Física', 'Arte'].map(subject => {
                                        const config = evalConfigs.find(c => c.section.id === section.id)?.configs.find(conf => 
                                            conf.subject.toLowerCase() === subject.toLowerCase()
                                        );
                                        const evalCount = config?.evaluation_count || 4;
                                        return `
                                            <div class="subject-eval-row">
                                                <label>${escapeHtml(subject)}:</label>
                                                <select class="eval-count-select" data-section-id="${section.id}" data-subject="${escapeHtml(subject)}">
                                                    <option value="3" ${evalCount === 3 ? 'selected' : ''}>3 Evaluaciones</option>
                                                    <option value="4" ${evalCount === 4 ? 'selected' : ''}>4 Evaluaciones</option>
                                                </select>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="config-actions">
                        <button id="guardar-config-evaluaciones" class="btn-primary">Guardar Configuración</button>
                        <button id="cancelar-config-evaluaciones" class="btn-secondary">Cancelar</button>
                    </div>
                </div>
            `;

            document.getElementById('guardar-config-evaluaciones').addEventListener('click', async () => {
                const selects = document.querySelectorAll('.eval-count-select');
                const changes = [];

                selects.forEach(select => {
                    changes.push({
                        sectionId: select.dataset.sectionId,
                        subject: select.dataset.subject,
                        evaluationCount: parseInt(select.value)
                    });
                });

                try {
                    await Promise.all(changes.map(change => 
                        api.configureSectionEvaluations(change.sectionId, change.subject, change.evaluationCount)
                    ));
                    showToast('Configuración de evaluaciones guardada correctamente', 'success');
                } catch (e) {
                    showToast(`Error: ${e.message}`, 'error');
                }
            });

            document.getElementById('cancelar-config-evaluaciones').addEventListener('click', () => {
                content.classList.add('hidden');
            });

        } catch (e) {
            content.innerHTML = `<p class="error">Error: ${escapeHtml(e.message)}</p>`;
        }
    }

    async function gestionarDocentesAdmin() {
        const content = document.getElementById('admin-content');
        content.classList.remove('hidden');
        content.innerHTML = '<p>Cargando...</p>';

        try {
            const [teachers, sections] = await Promise.all([api.getTeachers(), api.getSections()]);
            sectionsList = sections;
            const sectionOptions = sections.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.section_code || '')})</option>`).join('');
            const sectionsMap = new Map(sections.map(s => [String(s.id), `${s.name} (${s.section_code || '-'})`]));

            content.innerHTML = `
                <h4>Gestión de Docentes</h4>
                <div class="panel-card form-panel">
                    <h5>Registrar docente</h5>
                    <form id="teacher-form" class="grid-form">
                        <input type="text" id="teacher-name" placeholder="Nombre del docente" required>
                        <input type="text" id="teacher-username" placeholder="Usuario" required>
                        <input type="password" id="teacher-password" placeholder="Contraseña" required>
                        <input type="text" id="teacher-subject" placeholder="Materia única" required>
                        <input type="text" id="teacher-code-field" placeholder="Código del docente (opcional)">
                        <select id="teacher-sections-field" multiple required>
                            ${sectionOptions}
                        </select>
                        <button type="submit"><i class="fas fa-user-plus"></i> Guardar docente</button>
                    </form>
                    <p class="field-help">Mantén presionada Ctrl para seleccionar varias secciones.</p>
                </div>
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Usuario</th>
                            <th>Código</th>
                            <th>Materia</th>
                            <th>Secciones</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${teachers.map(t => {
                            const readableSections = (t.sections || '')
                                .split(',')
                                .map(id => id.trim())
                                .filter(Boolean)
                                .map(id => sectionsMap.get(id) || `ID ${id}`)
                                .join(', ');

                            return `
                                <tr>
                                    <td>${escapeHtml(t.name)}</td>
                                    <td>${escapeHtml(t.username)}</td>
                                    <td><code>${escapeHtml(t.teacher_code || '')}</code></td>
                                    <td>${escapeHtml(t.subject || '')}</td>
                                    <td>${escapeHtml(readableSections)}</td>
                                    <td>
                                        <button type="button" class="btn-editar-docente"
                                            data-id="${t.id}"
                                            data-code="${escapeHtml(t.teacher_code || '')}"
                                            data-subject="${escapeHtml(t.subject || '')}"
                                            data-sections="${escapeHtml(t.sections || '')}">
                                            Editar acceso
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;

            document.getElementById('teacher-form').addEventListener('submit', submitNuevoDocente);
            content.querySelectorAll('.btn-editar-docente').forEach(btn => {
                btn.addEventListener('click', () => abrirEditorDocente(btn.dataset.id, btn.dataset.code, btn.dataset.sections, btn.dataset.subject));
            });
        } catch (e) {
            content.innerHTML = `<p class="error">Error: ${escapeHtml(e.message)}</p>`;
        }
    }

    async function submitNuevoDocente(event) {
        event.preventDefault();
        const name = document.getElementById('teacher-name').value.trim();
        const username = document.getElementById('teacher-username').value.trim();
        const password = document.getElementById('teacher-password').value.trim();
        const subject = document.getElementById('teacher-subject').value.trim();
        const teacherCode = document.getElementById('teacher-code-field').value.trim();
        const sections = getSelectedValues('teacher-sections-field').join(',');

        try {
            const res = await api.createTeacher(name, username, password, sections, subject, teacherCode || undefined);
            showToast(`Docente registrado. Código: ${res.teacher_code}`, 'success');
            gestionarDocentesAdmin();
        } catch (e) {
            showToast(`Error: ${e.message}`, 'error');
        }
    }

    function abrirEditorDocente(id, code, currentSections, subject) {
        const content = document.getElementById('admin-content');
        const editor = document.createElement('div');
        editor.className = 'panel-card inline-editor';
        editor.innerHTML = `
            <h5>Editar acceso del docente</h5>
            <form id="edit-teacher-form" class="grid-form compact-form">
                <input type="hidden" id="edit-teacher-id" value="${escapeHtml(id)}">
                <input type="text" id="edit-teacher-subject" value="${escapeHtml(subject || '')}" placeholder="Materia" required>
                <input type="text" id="edit-teacher-code" value="${escapeHtml(code || '')}" placeholder="Código docente" required>
                <select id="edit-teacher-sections" multiple required>
                    ${sectionsList.map(section => `
                        <option value="${section.id}" ${(currentSections || '').split(',').map(s => s.trim()).includes(String(section.id)) ? 'selected' : ''}>
                            ${escapeHtml(section.name)} (${escapeHtml(section.section_code || '')})
                        </option>
                    `).join('')}
                </select>
                <div class="inline-actions">
                    <button type="submit">Guardar cambios</button>
                    <button type="button" id="cancel-teacher-edit" class="btn-secondary">Cancelar</button>
                </div>
            </form>
        `;

        const oldEditor = content.querySelector('.inline-editor');
        if (oldEditor) oldEditor.remove();
        content.prepend(editor);

        document.getElementById('edit-teacher-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const teacherId = document.getElementById('edit-teacher-id').value;
            const updatedSubject = document.getElementById('edit-teacher-subject').value.trim();
            const updatedCode = document.getElementById('edit-teacher-code').value.trim();
            const updatedSections = getSelectedValues('edit-teacher-sections').join(',');

            try {
                await api.updateTeacherPermissions(teacherId, updatedSections, updatedSubject, updatedCode);
                showToast('Permisos del docente actualizados', 'success');
                gestionarDocentesAdmin();
            } catch (e) {
                showToast(`Error: ${e.message}`, 'error');
            }
        });

        document.getElementById('cancel-teacher-edit').addEventListener('click', () => editor.remove());
    }

    async function gestionarEstudiantesAdmin() {
        const content = document.getElementById('admin-content');
        content.classList.remove('hidden');
        content.innerHTML = '<p>Cargando...</p>';

        try {
            const [students, sections] = await Promise.all([api.getAllStudents(), api.getSections()]);
            sectionsList = sections;

            content.innerHTML = `
                <h4>Gestión de Estudiantes</h4>
                <div class="dashboard-two-columns">
                    <div class="panel-card form-panel">
                        <h5>Agregar estudiante</h5>
                        <form id="student-form" class="grid-form compact-form">
                            <input type="text" id="student-name-field" placeholder="Nombre completo" required>
                            <select id="student-section-field" required>
                                <option value="">Seleccione la sección</option>
                                ${sections.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.section_code || '')})</option>`).join('')}
                            </select>
                            <input type="number" id="student-list-number" placeholder="Número de lista" min="1" required>
                            <input type="text" id="student-code-field" placeholder="Código estudiante (opcional)">
                            <button type="submit"><i class="fas fa-user-plus"></i> Guardar estudiante</button>
                        </form>
                    </div>
                    <div class="panel-card form-panel">
                        <h5>Baneos por nombre</h5>
                        <div class="ban-search stacked-search">
                            <input type="text" id="ban-name-input" placeholder="Nombre completo...">
                            <input type="text" id="ban-year-input" placeholder="Año (opcional)...">
                            <div class="inline-actions full-width-actions">
                                <button id="btn-banear-estudiante" type="button" class="btn-block">Banear</button>
                                <button id="btn-desbanear-estudiante" type="button" class="btn-unblock">Desbanear</button>
                            </div>
                            <button id="btn-cargar-estudiantes" type="button"><i class="fas fa-file-upload"></i> Cargar PDF/Excel</button>
                        </div>
                    </div>
                </div>
                <div class="table-toolbar">
                    <input type="text" id="student-search" placeholder="Buscar estudiante, código o sección...">
                </div>
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>N° Lista</th>
                            <th>Nombre</th>
                            <th>Sección</th>
                            <th>Cód. Salón</th>
                            <th>Cód. Estudiante</th>
                            <th>Estado</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody id="students-admin-tbody">
                        ${students.map(s => `
                            <tr class="${s.blocked ? 'row-blocked' : ''}" data-search="${escapeHtml(`${s.name} ${s.section_name} ${s.section_code} ${s.student_code}`.toLowerCase())}">
                                <td>${escapeHtml(s.list_number || '-')}</td>
                                <td>${escapeHtml(s.name)}</td>
                                <td>${escapeHtml(s.section_name || '')}</td>
                                <td><code>${escapeHtml(s.section_code || '')}</code></td>
                                <td><code>${escapeHtml(s.student_code || '')}</code></td>
                                <td>${s.blocked ? 'BANEADO' : 'ACTIVO'}</td>
                                <td>
                                    <button type="button" class="btn-toggle-bloqueo" data-id="${s.id}" data-status="${s.blocked ? 0 : 1}">
                                        ${s.blocked ? 'Desbloquear' : 'Banear'}
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            document.getElementById('student-form').addEventListener('submit', submitNuevoEstudiante);
            document.getElementById('btn-banear-estudiante').addEventListener('click', () => uiBanearPorNombre(true));
            document.getElementById('btn-desbanear-estudiante').addEventListener('click', () => uiBanearPorNombre(false));
            document.getElementById('btn-cargar-estudiantes').addEventListener('click', uiCargarEstudiantesArchivo);
            document.getElementById('student-search').addEventListener('input', filterStudentRows);
            content.querySelectorAll('.btn-toggle-bloqueo').forEach(btn => {
                btn.addEventListener('click', () => toggleBloqueoEstudiante(btn.dataset.id, btn.dataset.status));
            });
        } catch (e) {
            content.innerHTML = `<p class="error">Error: ${escapeHtml(e.message)}</p>`;
        }
    }

    function filterStudentRows() {
        const query = document.getElementById('student-search').value.trim().toLowerCase();
        document.querySelectorAll('#students-admin-tbody tr').forEach(row => {
            const haystack = row.dataset.search || '';
            row.style.display = haystack.includes(query) ? '' : 'none';
        });
    }

    async function submitNuevoEstudiante(event) {
        event.preventDefault();
        const name = document.getElementById('student-name-field').value.trim();
        const sectionId = document.getElementById('student-section-field').value;
        const listNumber = document.getElementById('student-list-number').value.trim();
        const studentCode = document.getElementById('student-code-field').value.trim();

        try {
            await api.addStudent(name, sectionId, listNumber, studentCode || listNumber);
            showToast('Estudiante registrado correctamente', 'success');
            gestionarEstudiantesAdmin();
        } catch (e) {
            showToast(`Error: ${e.message}`, 'error');
        }
    }

    async function uiBanearPorNombre(blocked) {
        const name = document.getElementById('ban-name-input').value.trim();
        const year = document.getElementById('ban-year-input').value.trim();
        if (!name) return;
        if (!confirm('¿Confirmar acción?')) return;
        try {
            const res = await api.blockStudentByName(name, year, blocked);
            showToast(res.message, 'success');
            gestionarEstudiantesAdmin();
        } catch (e) {
            showToast(`Error: ${e.message}`, 'error');
        }
    }

    async function toggleBloqueoEstudiante(id, blockStatus) {
        if (!confirm('¿Confirmar acción?')) return;
        try {
            await api.blockStudent(id, blockStatus);
            showToast('Estado del estudiante actualizado', 'success');
            gestionarEstudiantesAdmin();
        } catch (e) {
            showToast(`Error: ${e.message}`, 'error');
        }
    }

    function uiCargarEstudiantesArchivo() {
        const sectionId = document.getElementById('student-section-field')?.value || '';
        if (!sectionId) {
            showToast('Selecciona una sección antes de cargar el archivo', 'error');
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.docx,.xlsx,.xls';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await api.uploadStudentsFile(file, sectionId);
                showToast('Archivo de estudiantes procesado', 'success');
                gestionarEstudiantesAdmin();
            } catch (error) {
                showToast(`Error: ${error.message}`, 'error');
            }
        };
        input.click();
    }

    async function verHistorialAdmin() {
        const content = document.getElementById('admin-content');
        content.classList.remove('hidden');
        content.innerHTML = '<p>Cargando...</p>';
        try {
            const audit = await api.getAudit();
            content.innerHTML = `
                <h4>Historial</h4>
                <div class="audit-list">
                    ${audit.map(a => `
                        <div class="audit-item">
                            <span class="audit-date">${new Date(a.timestamp).toLocaleString()}</span>
                            <span><strong>${escapeHtml(a.user_name || 'Sistema')}</strong>: ${escapeHtml(a.action)}</span>
                            <div class="audit-meta" style="font-size: 0.7rem; color: #666; margin-top: 5px;">
                                <span><i class="fas fa-network-wired"></i> IP: ${escapeHtml(a.ip || 'N/A')}</span> |
                                <span><i class="fas fa-laptop"></i> ${escapeHtml(a.user_agent ? (a.user_agent.length > 50 ? `${a.user_agent.substring(0, 50)}...` : a.user_agent) : 'N/A')}</span>
                            </div>
                            <pre class="audit-details">${escapeHtml(JSON.stringify(a.details, null, 2))}</pre>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            content.innerHTML = `<p class="error">Error: ${escapeHtml(e.message)}</p>`;
        }
    }

    async function verMisSeccionesDocente() {
        const container = document.getElementById('teacher-content');
        container.classList.remove('hidden');
        container.innerHTML = '<p>Cargando...</p>';
        try {
            const allSections = await api.getSections();
            const mySections = allSections.filter(s => (currentUser.sections || []).includes(String(s.id)));
            if (mySections.length === 0) {
                container.innerHTML = '<p>Sin secciones asignadas.</p>';
                return;
            }
            const sectionsByYear = getSectionsByYear(mySections);
            container.innerHTML = `
                <h4>Mis Carpetas</h4>
                <p class="teacher-subject-badge">Solo puedes gestionar la materia: <strong>${escapeHtml(currentUser.subject || 'Sin materia')}</strong></p>
                <div class="folders-container">
                    ${Object.keys(sectionsByYear).sort().map(year => `
                        <div class="year-group">
                            <h5>Año: ${escapeHtml(year)}</h5>
                            <div class="sections-grid sections-grid-wide">
                                ${sectionsByYear[year].map(s => `
                                    <div class="folder-item doc-folder card-folder" data-id="${s.id}" data-name="${escapeHtml(s.name)}">
                                        <i class="fas fa-folder fa-3x"></i>
                                        <span>${escapeHtml(s.name)}</span>
                                        <small>Nivel: ${escapeHtml(s.level || '-')}</small>
                                        <small>Código: ${escapeHtml(s.section_code || '')}</small>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div id="teacher-folder-view" class="folder-content-view hidden"></div>
            `;
            container.querySelectorAll('.doc-folder').forEach(item => {
                item.addEventListener('click', () => abrirCarpetaDocente(item.dataset.id, item.dataset.name));
            });
        } catch (e) {
            container.innerHTML = `<p class="error">Error: ${escapeHtml(e.message)}</p>`;
        }
    }

    async function abrirCarpetaDocente(id, name) {
        const view = document.getElementById('teacher-folder-view');
        view.classList.remove('hidden');
        view.innerHTML = '<p>Abriendo...</p>';
        currentTeacherSection = { id, name };

        try {
            const filesResult = await api.getSectionFiles(id);
            const subjectFile = (filesResult.files || []).find(file => String(file.subject).toLowerCase() === String(currentUser.subject).toLowerCase()) || { resources: [] };
            const result = await api.getSectionGradesSummary(id);
            const students = result.students || [];
            const section = result.section || { name };
            const resources = subjectFile.resources || [];
            
            // Obtener configuración de evaluaciones para esta materia
            const evalConfig = result.evaluationConfigs.find(config => 
                config.subject.toLowerCase() === currentUser.subject.toLowerCase()
            ) || { evaluation_count: 4 };
            
            const evaluationCount = evalConfig.evaluation_count;
            view.innerHTML = `
                <div class="folder-header">
                    <div>
                        <h5><i class="fas fa-folder-open"></i> Carpeta: ${escapeHtml(section.name || name)}</h5>
                        <p class="folder-meta">Archivo visible: <strong>${escapeHtml(currentUser.subject)}</strong> | Código del salón: <strong>${escapeHtml(section.sectionCode || '')}</strong></p>
                    </div>
                    <button class="btn-close-folder">Cerrar</button>
                </div>
                <div class="teacher-actions teacher-actions-stack">
                    <div class="subject-file-card">
                        <i class="fas fa-file-alt fa-2x"></i>
                        <div>
                            <strong>${escapeHtml(currentUser.subject)}</strong>
                            <span>Único archivo habilitado para este docente</span>
                        </div>
                    </div>
                    <div class="inline-actions">
                        <button id="btn-cargar-notas-archivo" class="btn-primary">Cargar notas desde archivo</button>
                        <button id="btn-subir-recurso" class="btn-primary">Subir PDF o Word</button>
                        <button id="btn-guardar-notas-tabla" class="btn-primary">Guardar cambios</button>
                    </div>
                </div>
                <div class="panel-card resource-panel">
                    <h6>Documentos de apoyo de la materia</h6>
                    <div class="resource-list">
                        ${resources.length > 0 ? resources.map(resource => `
                            <a class="resource-item" href="/${resource.path}" target="_blank" rel="noopener noreferrer">
                                <i class="fas fa-file-alt"></i>
                                <span>${escapeHtml(resource.title || resource.name)}</span>
                            </a>
                        `).join('') : '<p>No hay documentos cargados todavía.</p>'}
                    </div>
                </div>
                <div class="teacher-students-list-view">
                    <h6 class="subject-title-center">${escapeHtml(currentUser.subject)} (${evaluationCount} evaluaciones)</h6>
                    <table class="grades-table">
                        <thead>
                            <tr>
                                <th>N° Lista</th>
                                <th>Nombre</th>
                                ${Array.from({length: evaluationCount}, (_, i) => `<th>Nota ${i + 1}</th>`).join('')}
                                <th>Definitiva</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody id="teacher-grades-body">
                            ${renderTeacherTableRowsWithEvaluations(students, currentUser.subject, evaluationCount)}
                        </tbody>
                    </table>
                </div>
            `;
            view.querySelector('.btn-close-folder').addEventListener('click', () => view.classList.add('hidden'));
            view.querySelector('#btn-cargar-notas-archivo').addEventListener('click', () => uiCargarNotasPC(id, name));
            view.querySelector('#btn-subir-recurso').addEventListener('click', () => subirRecursoDocente(id, name));
            view.querySelector('#btn-guardar-notas-tabla').addEventListener('click', () => guardarNotasTablaDocente(id, name));
        } catch (e) {
            view.innerHTML = `<p class="error">Error: ${escapeHtml(e.message)}</p>`;
        }
    }

    async function guardarNotasTablaDocente(sectionId, sectionName) {
        const gradeInputs = Array.from(document.querySelectorAll('#teacher-grades-body .table-grade-input'));

        const payload = gradeInputs
            .filter(input => input.value !== '' && !input.disabled)
            .map(input => ({
                studentId: input.dataset.studentId,
                studentName: input.dataset.studentName,
                grade: parseFloat(input.value),
                period: input.dataset.period || '1'
            }))
            .filter(item => !Number.isNaN(item.grade));

        if (payload.length === 0) {
            showToast('No hay notas válidas para guardar', 'error');
            return;
        }

        try {
            await Promise.all(payload.map(item => api.saveGrade(item.studentId, currentUser.subject, item.grade, item.period)));
            showToast('Notas guardadas correctamente', 'success');
            abrirCarpetaDocente(sectionId, sectionName);
        } catch (e) {
            showToast(`Error: ${e.message}`, 'error');
        }
    }

    function subirRecursoDocente(sectionId, sectionName) {
        const subject = currentUser.subject;
        const title = prompt('Título del documento (opcional):', `${subject} - material de apoyo`);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.docx';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await api.uploadSectionResource(sectionId, subject, title || file.name, file);
                showToast('Documento subido correctamente', 'success');
                abrirCarpetaDocente(sectionId, sectionName);
            } catch (error) {
                showToast(`Error: ${error.message}`, 'error');
            }
        };
        input.click();
    }

    function uiCargarNotasPC(sectionId, sectionName) {
        const subject = currentUser.subject;
        if (!subject) {
            showToast('Este docente no tiene materia asignada', 'error');
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.xls,.pdf,.docx';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const res = await api.uploadGradesFile(file, sectionName, subject);
                    showToast(`Carga completada: ${res.processed.length} procesadas`, 'success');
                    abrirCarpetaDocente(sectionId, sectionName);
                } catch (err) {
                    showToast(`Error: ${err.message}`, 'error');
                }
            }
        };
        input.click();
    }

    async function loadStudentView() {
        const gradesList = document.getElementById('student-grades-list');
        const sectionInfo = document.getElementById('student-section-info');
        try {
            const data = await api.getStudentOwnGrades();
            sectionInfo.innerHTML = `
                <div class="student-summary-card">
                    <div><strong>Sección:</strong> ${escapeHtml(data.student.section)}</div>
                    <div><strong>Código del salón:</strong> ${escapeHtml(data.student.sectionCode)}</div>
                    <div><strong>Código del estudiante:</strong> ${escapeHtml(data.student.studentCode)}</div>
                    <div><strong>N° de lista:</strong> ${escapeHtml(data.student.listNumber || '-')}</div>
                </div>
            `;

            gradesList.innerHTML = `
                <div class="student-private-banner">Solo estás viendo tus notas. No se muestran datos de otros estudiantes.</div>
                <div class="teacher-students-list-view">
                    <h6 class="subject-title-center">Mis notas</h6>
                    <table class="grades-table">
                        <thead>
                            <tr>
                                <th>Materia</th>
                                <th>Nota</th>
                                <th>Periodo</th>
                                <th>Actualizado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.grades.length > 0 ? data.grades.map(g => `
                                <tr>
                                    <td>${escapeHtml(g.subject)}</td>
                                    <td>${escapeHtml(g.grade)}</td>
                                    <td>${escapeHtml(g.period || '-')}</td>
                                    <td>${g.updated_at ? new Date(g.updated_at).toLocaleString() : '-'}</td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="4" style="text-align:center;">Sin notas cargadas aún</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            gradesList.innerHTML = `<p class="error">Error: ${escapeHtml(e.message)}</p>`;
        }
    }

    async function exportarResumenAdmin() {
        try {
            const [sections, teachers, students, audit] = await Promise.all([
                api.getSections(),
                api.getTeachers(),
                api.getAllStudents(),
                api.getAudit()
            ]);

            const exportBox = document.getElementById('export-output');
            const activos = students.filter(student => !student.blocked).length;
            const baneados = students.filter(student => student.blocked).length;
            exportBox.classList.remove('hidden');
            exportBox.innerHTML = `
                <div class="panel-card export-card">
                    <h4>Resumen general del sistema</h4>
                    <div class="stats-grid">
                        <div class="stat-card"><strong>${sections.length}</strong><span>Secciones</span></div>
                        <div class="stat-card"><strong>${teachers.length}</strong><span>Docentes</span></div>
                        <div class="stat-card"><strong>${students.length}</strong><span>Estudiantes</span></div>
                        <div class="stat-card"><strong>${baneados}</strong><span>Baneados</span></div>
                    </div>
                    <div class="dashboard-two-columns">
                        <div>
                            <h5>Secciones</h5>
                            <ul class="summary-list">
                                ${sections.map(section => `<li>${escapeHtml(section.name)} - ${escapeHtml(section.year || '-')} - ${escapeHtml(section.section_code || '-')}</li>`).join('')}
                            </ul>
                        </div>
                        <div>
                            <h5>Docentes</h5>
                            <ul class="summary-list">
                                ${teachers.map(teacher => `<li>${escapeHtml(teacher.name)} - ${escapeHtml(teacher.subject || 'Sin materia')} - ${escapeHtml(teacher.teacher_code || '-')}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                    <p class="export-footer">Estudiantes activos: <strong>${activos}</strong> | Últimos movimientos: <strong>${audit.length}</strong></p>
                </div>
            `;
            showToast('Resumen generado', 'success');
        } catch (e) {
            showToast(`Error al exportar resumen: ${e.message}`, 'error');
        }
    }

    function initNav(mainSections, subSections) {
        document.querySelectorAll('nav a, .logo').forEach(a => {
            a.addEventListener('click', e => {
                const href = a.getAttribute('href') || '#inicio';
                if (href.startsWith('#')) {
                    const id = href.slice(1);
                    if (id) {
                        e.preventDefault();
                        UI.showView(id, mainSections, subSections);
                        if (id === 'inicio') {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        } else {
                            const target = document.getElementById(id);
                            if (target) target.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                }
            });
        });
    }

    function initForms() {
        ['', '-cede1', '-cede2'].forEach(suffix => {
            const form = document.getElementById(`form-preguntas${suffix}`);
            if (form) {
                form.addEventListener('submit', function (e) {
                    e.preventDefault();
                    const suffixId = suffix === '-cede1' ? 'Cede1' : (suffix === '-cede2' ? 'Cede2' : '');
                    const nombre = document.getElementById(`nombrePregunta${suffixId}`).value.trim();
                    const email = document.getElementById(`emailPregunta${suffixId}`).value.trim();
                    const preg1 = document.getElementById(`pregunta1${suffixId}`).value.trim();
                    const preg2 = document.getElementById(`pregunta2${suffixId}`).value.trim();
                    const preg3 = document.getElementById(`pregunta3${suffixId}`).value.trim();
                    const mensaje = document.getElementById(`mensaje-preguntas${suffix}`);

                    if (!nombre || !email || !preg1) {
                        mensaje.style.color = 'red';
                        mensaje.innerText = 'Por favor complete su nombre, correo electrónico y al menos una pregunta.';
                        return;
                    }

                    const to = 'Samuel615@gmail.com';
                    const subject = `Consultas cupo ${suffix ? suffix.replace('-', ' ') : ''} de ${nombre}`;
                    let body = `Nombre: ${encodeURIComponent(nombre)}%0AEmail: ${encodeURIComponent(email)}%0A%0A`;
                    body += `Pregunta 1: ${encodeURIComponent(preg1)}%0A`;
                    if (preg2) body += `Pregunta 2: ${encodeURIComponent(preg2)}%0A`;
                    if (preg3) body += `Pregunta 3: ${encodeURIComponent(preg3)}%0A`;
                    body += '%0AEnviado desde el formulario de la página.';

                    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${body}`;
                    mensaje.style.color = 'green';
                    mensaje.innerText = 'Su cliente de correo se ha abierto.';
                    this.reset();
                });
            }
        });
    }

    function switchLoginTab(tab) {
        document.querySelectorAll('.login-tab').forEach(btn => btn.classList.remove('active'));
        const tabBtn = document.getElementById(`${tab}-tab`);
        if (tabBtn) tabBtn.classList.add('active');
        document.querySelectorAll('.login-form').forEach(form => form.classList.add('hidden'));
        const loginForm = document.getElementById(`${tab}-login`);
        if (loginForm) loginForm.classList.remove('hidden');
        setLoginMessage('', 'info');
    }

    async function initPlanificaciones() {
        try {
            const plans = await api.getPlanificaciones();
            ['preescolar', 'primaria', 'bachillerato'].forEach(level => {
                const ul = document.getElementById(`plan-${level}`);
                if (!ul) return;
                ul.innerHTML = '';
                const levelPlans = plans.filter(p => p.level === level);
                if (levelPlans.length === 0) {
                    ul.innerHTML = '<li>No hay planificaciones disponibles.</li>';
                    return;
                }
                levelPlans.forEach(doc => {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = '#';
                    a.innerText = doc.label;
                    a.addEventListener('click', e => {
                        e.preventDefault();
                        UI.openDoc(doc.file);
                    });
                    li.appendChild(a);
                    ul.appendChild(li);
                });
            });
        } catch (err) {
            ['preescolar', 'primaria', 'bachillerato'].forEach(level => {
                const ul = document.getElementById(`plan-${level}`);
                if (ul) ul.innerHTML = '<li class="error">Error al cargar datos.</li>';
            });
        }
        const closeBtn = document.querySelector('#doc-viewer .close-view');
        if (closeBtn) closeBtn.addEventListener('click', () => UI.closeDocViewer());
    }

    return {
        init() {
            document.body.classList.add('js-active');
            try {
                if (typeof ApiClient !== 'undefined') {
                    api = new ApiClient();
                }
            } catch (e) {
                console.error('ApiClient error');
            }

            document.querySelectorAll('.scroll-anim').forEach(el => observer.observe(el));

            const mainSections = Array.from(document.querySelectorAll('header[id], section[id]')).filter(el => {
                return !el.id.includes('-') || ['planificaciones', 'cede1', 'cede2', 'registro', 'contacto'].includes(el.id);
            });
            const subSections = ['planificaciones', 'cede1', 'cede2', 'registro'];

            initNav(mainSections, subSections);
            initForms();
            initPlanificaciones();

            const addListener = (id, event, callback) => {
                const el = document.getElementById(id);
                if (el) el.addEventListener(event, callback);
            };

            addListener('admin-tab', 'click', () => switchLoginTab('admin'));
            addListener('teacher-tab', 'click', () => switchLoginTab('teacher'));
            addListener('student-tab', 'click', () => switchLoginTab('student'));
            addListener('admin-login-btn', 'click', handleAdminLogin);
            addListener('teacher-login-btn', 'click', handleTeacherLogin);
            addListener('student-login-btn', 'click', handleStudentLogin);
            addListener('ver-secciones-btn', 'click', verTodasLasSecciones);
            addListener('configurar-evaluaciones-btn', 'click', configurarEvaluacionesAdmin);
            addListener('gestionar-docentes-btn', 'click', gestionarDocentesAdmin);
            addListener('gestionar-estudiantes-btn', 'click', gestionarEstudiantesAdmin);
            addListener('ver-historial-btn', 'click', verHistorialAdmin);
            addListener('ver-mis-secciones-btn', 'click', verMisSeccionesDocente);
            addListener('exportar-datos-btn', 'click', exportarResumenAdmin);
            addListener('logout-btn', 'click', logout);
            addListener('logout-teacher-btn', 'click', logout);
            addListener('logout-student-btn', 'click', logout);

            document.querySelectorAll('#docentes .tab-btn').forEach(btn => {
                btn.addEventListener('click', () => UI.renderDocentes(btn.dataset.nivel, 'docentes-grid', 'docentes'));
            });
            document.querySelectorAll('#docentes-cede1 .tab-btn').forEach(btn => {
                btn.addEventListener('click', () => UI.renderDocentes(btn.dataset.nivel, 'docentes-grid-cede1', 'docentes-cede1'));
            });
            document.querySelectorAll('#docentes-cede2 .tab-btn').forEach(btn => {
                btn.addEventListener('click', () => UI.renderDocentes(btn.dataset.nivel, 'docentes-grid-cede2', 'docentes-cede2'));
            });

            UI.showView('inicio', mainSections, subSections);
            UI.renderDocentes('bachillerato', 'docentes-grid', 'docentes');
            UI.renderDocentes('primaria', 'docentes-grid-cede1', 'docentes-cede1');
            UI.renderDocentes('preescolar', 'docentes-grid-cede2', 'docentes-cede2');

            const currentHash = window.location.hash.slice(1);
            if (currentHash && (currentHash === 'inicio' || subSections.includes(currentHash))) {
                UI.showView(currentHash, mainSections, subSections);
            }
        }
    };
})();

document.addEventListener('DOMContentLoaded', () => AppController.init());
