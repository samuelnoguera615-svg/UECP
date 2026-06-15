const API_BASE = `${window.location.protocol}//${window.location.hostname}:3001/api`;

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
    }

    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
        const config = {
            headers: {
                ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
                ...(options.headers || {})
            },
            ...options
        };

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
	    const data = await response.json();


            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return data;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('No se puede conectar al servidor.');
            }
            throw error;
        }
    }

    async health() {
        return this.request('/health');
    }

    async login(username, password) {
        const data = await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        this.setToken(data.token);
        return data.user;
    }

    async loginTeacher(code) {
        const data = await this.request('/login-teacher', {
            method: 'POST',
            body: JSON.stringify({ code })
        });
        this.setToken(data.token);
        return data.user;
    }

    async loginStudent(sectionCode, studentCode) {
        const data = await this.request('/login-student', {
            method: 'POST',
            body: JSON.stringify({ sectionCode, studentCode })
        });
        this.setToken(data.token);
        return data.student;
    }

    async getSections() {
        return this.request('/sections');
    }

    async createSection(name, level, year, sectionCode) {
        return this.request('/sections', {
            method: 'POST',
            body: JSON.stringify({ name, level, year, sectionCode })
        });
    }

    async deleteSection(id) {
        return this.request(`/sections/${id}`, {
            method: 'DELETE'
        });
    }

    async getTeachers() {
        return this.request('/teachers');
    }

    async createTeacher(name, username, password, sections, subject, teacherCode) {
        return this.request('/teachers', {
            method: 'POST',
            body: JSON.stringify({ name, username, password, sections, subject, teacherCode })
        });
    }

    async updateTeacherPermissions(teacherId, sections, subject, teacherCode) {
        return this.request(`/teachers/${teacherId}/permissions`, {
            method: 'PUT',
            body: JSON.stringify({ sections, subject, teacher_code: teacherCode })
        });
    }

    async getAllStudents() {
        return this.request('/students');
    }

    async getStudentsInSection(sectionId) {
        return this.request(`/sections/${sectionId}/students`);
    }

    async addStudent(name, sectionId, listNumber, studentCode) {
        return this.request('/students', {
            method: 'POST',
            body: JSON.stringify({ name, sectionId, listNumber, studentCode })
        });
    }

    async blockStudent(studentId, blocked) {
        return this.request(`/students/${studentId}/block`, {
            method: 'PUT',
            body: JSON.stringify({ blocked })
        });
    }

    async blockStudentByName(name, year, blocked) {
        return this.request('/students/block-by-name-year', {
            method: 'PUT',
            body: JSON.stringify({ name, year, blocked })
        });
    }

    async uploadStudentsFile(file, sectionId) {
        const formData = new FormData();
        formData.append('studentsFile', file);
        formData.append('sectionId', sectionId);

        return this.request('/upload-students', {
            method: 'POST',
            headers: {},
            body: formData
        });
    }

    async uploadGradesFile(file, sectionName, subject) {
        const formData = new FormData();
        formData.append('gradesFile', file);
        formData.append('sectionName', sectionName);
        formData.append('subject', subject);

        return this.request('/upload-grades', {
            method: 'POST',
            headers: {},
            body: formData
        });
    }

    async getStudentGrades(studentId) {
        return this.request(`/students/${studentId}/grades`);
    }

    async getStudentOwnGrades() {
        return this.request('/student/grades');
    }

    async getSectionGradesForStudent(sectionCode) {
        return this.request(`/grades/section/${sectionCode}`);
    }

    async getSectionFiles(sectionId) {
        return this.request(`/sections/${sectionId}/files`);
    }

    async getSectionSubjectGrades(sectionId, subject) {
        const query = new URLSearchParams({ subject }).toString();
        return this.request(`/sections/${sectionId}/grades-by-subject?${query}`);
    }

    async uploadSectionResource(sectionId, subject, title, file) {
        const formData = new FormData();
        formData.append('subject', subject);
        formData.append('title', title || file.name);
        formData.append('resourceFile', file);

        return this.request(`/sections/${sectionId}/resources`, {
            method: 'POST',
            headers: {},
            body: formData
        });
    }

    async getPlanificaciones() {
        return this.request('/planificaciones');
    }

    async saveGrade(studentId, subject, grade, period) {
        return this.request('/grades', {
            method: 'POST',
            body: JSON.stringify({ studentId, subject, grade, period })
        });
    }

    async getAudit() {
        return this.request('/audit');
    }

    async getSectionEvaluations(sectionId) {
        return this.request(`/sections/${sectionId}/evaluations`);
    }

    async configureSectionEvaluations(sectionId, subject, evaluationCount) {
        return this.request(`/sections/${sectionId}/evaluations`, {
            method: 'POST',
            body: JSON.stringify({ subject, evaluationCount })
        });
    }

    async getSectionGradesSummary(sectionId) {
        return this.request(`/sections/${sectionId}/grades-summary`);
    }
}
