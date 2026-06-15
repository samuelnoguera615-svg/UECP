const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const crypto = require('crypto');
require('dotenv').config();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const xss = require('xss-clean');

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.SECRET_KEY || 'uecp_secret_key_2026';

app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Demasiadas peticiones desde esta IP, por favor intente de nuevo en 15 minutos' }
});
app.use('/api/', limiter);

app.use(xss());
app.use(hpp());

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

if (!fs.existsSync('sections')) {
    fs.mkdirSync('sections');
}

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '2mb' }));
app.use(express.static('.'));
app.use('/sections', express.static('sections'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'uecp.html'));
});

const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }
});

const db = new sqlite3.Database('./school.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        initDatabase();
    }
});

function runSafe(sql) {
    db.run(sql, () => {});
}

function initDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT,
            name TEXT,
            sections TEXT,
            subject TEXT,
            teacher_code TEXT UNIQUE,
            blocked BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            level TEXT,
            year TEXT,
            section_code TEXT UNIQUE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            section_id INTEGER,
            student_code TEXT,
            list_number INTEGER,
            blocked BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (section_id) REFERENCES sections (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            subject TEXT,
            grade REAL,
            period TEXT,
            teacher_id INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students (id),
            FOREIGN KEY (teacher_id) REFERENCES users (id),
            UNIQUE(student_id, subject, period)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT,
            details TEXT,
            ip TEXT,
            user_agent TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS section_evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            section_id INTEGER,
            subject TEXT,
            evaluation_count INTEGER DEFAULT 4,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (section_id) REFERENCES sections (id),
            UNIQUE(section_id, subject)
        )`);

        runSafe(`ALTER TABLE users ADD COLUMN subject TEXT`);
        runSafe(`ALTER TABLE sections ADD COLUMN section_code TEXT`);
        runSafe(`ALTER TABLE students ADD COLUMN list_number INTEGER`);
        runSafe(`ALTER TABLE students ADD COLUMN blocked BOOLEAN DEFAULT FALSE`);
        runSafe(`ALTER TABLE users ADD COLUMN blocked BOOLEAN DEFAULT FALSE`);
        runSafe(`ALTER TABLE audit_log ADD COLUMN ip TEXT`);
        runSafe(`ALTER TABLE audit_log ADD COLUMN user_agent TEXT`);

        const salt = bcrypt.genSaltSync(10);
        const adminPass = bcrypt.hashSync('admin123', salt);

        for (let i = 1; i <= 4; i++) {
            db.run(
                'INSERT OR IGNORE INTO users (username, password, role, name, teacher_code) VALUES (?, ?, ?, ?, ?)',
                [`admin${i}`, adminPass, 'admin', `Administrador ${i}`, `ADMIN_00${i}`]
            );
        }
    });
}

function logAction(req, userId, action, details) {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
    const userAgent = req ? req.headers['user-agent'] : null;
    db.run(
        'INSERT INTO audit_log (user_id, action, details, ip, user_agent) VALUES (?, ?, ?, ?, ?)',
        [userId, action, JSON.stringify(details), ip, userAgent]
    );
}

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function generateCode(prefix, size = 3) {
    return `${prefix}${crypto.randomBytes(size).toString('hex').toUpperCase()}`;
}

function isAllowedFileExtension(fileName, allowedExtensions) {
    const ext = path.extname(fileName || '').toLowerCase();
    return allowedExtensions.includes(ext);
}

function sanitizeFileName(fileName) {
    return String(fileName || '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_');
}

function authenticateToken(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, SECRET_KEY, (err, payload) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });

        if (payload.role === 'student') {
            db.get(
                `SELECT s.*, sec.name AS section_name, sec.section_code
                 FROM students s
                 JOIN sections sec ON sec.id = s.section_id
                 WHERE s.id = ?`,
                [payload.id],
                (studentErr, student) => {
                    if (studentErr) return res.status(500).json({ error: studentErr.message });
                    if (!student) return res.status(401).json({ error: 'Invalid student' });
                    if (student.blocked) return res.status(403).json({ error: 'Tu acceso a las notas ha sido restringido por la administración' });

                    req.user = {
                        id: student.id,
                        role: 'student',
                        name: student.name,
                        sectionId: student.section_id,
                        section: student.section_name,
                        sectionCode: student.section_code,
                        studentCode: student.student_code,
                        listNumber: student.list_number
                    };
                    next();
                }
            );
            return;
        }

        db.get('SELECT * FROM users WHERE id = ?', [payload.id], (userErr, user) => {
            if (userErr) return res.status(500).json({ error: userErr.message });
            if (!user) return res.status(401).json({ error: 'Invalid user' });
            if (user.blocked) return res.status(403).json({ error: 'Tu cuenta ha sido bloqueada' });

            req.user = {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                sections: user.sections ? user.sections.split(',').map(s => s.trim()).filter(Boolean) : [],
                subject: user.subject || ''
            };
            next();
        });
    });
}

function teacherHasAccessToSection(user, sectionId, callback) {
    if (user.role === 'admin') return callback(null, true);
    if (user.role !== 'teacher') return callback(null, false);

    const allowed = (user.sections || []).includes(String(sectionId));
    callback(null, allowed);
}

function teacherOwnsSubject(user, subject) {
    if (user.role === 'admin') return true;
    if (user.role !== 'teacher') return false;
    return normalize(user.subject) === normalize(subject);
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user || !bcrypt.compareSync(password, user.password)) {
            logAction(req, null, 'login_failed', { username });
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (user.blocked) {
            logAction(req, user.id, 'login_blocked', { username });
            return res.status(403).json({ error: 'Tu cuenta ha sido bloqueada' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
        logAction(req, user.id, 'login_success', { username });
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                sections: user.sections ? user.sections.split(',').map(s => s.trim()).filter(Boolean) : [],
                subject: user.subject || ''
            }
        });
    });
});

app.post('/api/login-teacher', (req, res) => {
    const { code } = req.body;
    db.get('SELECT * FROM users WHERE teacher_code = ? AND role = ?', [code, 'teacher'], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) {
            logAction(req, null, 'login_teacher_failed', { code });
            return res.status(401).json({ error: 'Código de docente inválido' });
        }

        if (user.blocked) {
            logAction(req, user.id, 'login_teacher_blocked', { name: user.name });
            return res.status(403).json({ error: 'Tu cuenta ha sido bloqueada' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
        logAction(req, user.id, 'login_teacher_success', { name: user.name, subject: user.subject });
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                sections: user.sections ? user.sections.split(',').map(s => s.trim()).filter(Boolean) : [],
                subject: user.subject || ''
            }
        });
    });
});

app.post('/api/login-student', (req, res) => {
    const { sectionCode, studentCode } = req.body;

    db.get(
        `SELECT s.*, sec.name as section_name, sec.section_code
         FROM students s
         JOIN sections sec ON s.section_id = sec.id
         WHERE UPPER(sec.section_code) = UPPER(?) AND UPPER(s.student_code) = UPPER(?)`,
        [sectionCode, studentCode],
        (err, student) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!student) {
                logAction(req, null, 'login_student_failed', { sectionCode, studentCode });
                return res.status(401).json({ error: 'Código de salón o código de estudiante inválido' });
            }

            if (student.blocked) {
                logAction(req, student.id, 'login_student_blocked', { name: student.name });
                return res.status(403).json({ error: 'Tu acceso a las notas ha sido restringido por la administración' });
            }

            const token = jwt.sign(
                { id: student.id, role: 'student', sectionId: student.section_id },
                SECRET_KEY,
                { expiresIn: '4h' }
            );

            logAction(req, student.id, 'login_student_success', {
                name: student.name,
                section: student.section_name,
                sectionCode: student.section_code,
                studentCode: student.student_code
            });

            res.json({
                token,
                student: {
                    id: student.id,
                    name: student.name,
                    section: student.section_name,
                    sectionCode: student.section_code,
                    studentCode: student.student_code,
                    listNumber: student.list_number,
                    role: 'student'
                }
            });
        }
    );
});

app.get('/api/sections', authenticateToken, (req, res) => {
    db.all('SELECT * FROM sections ORDER BY year, name', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/sections', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const { name, level, year, sectionCode } = req.body;
    const normalizedSectionCode = (sectionCode || generateCode('SEC')).trim().toUpperCase();

    db.run(
        'INSERT INTO sections (name, level, year, section_code) VALUES (?, ?, ?, ?)',
        [name, level, year, normalizedSectionCode],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const folderPath = path.join('sections', String(year), String(name));
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }

            logAction(req, req.user.id, 'section_created', {
                sectionId: this.lastID,
                name,
                level,
                year,
                sectionCode: normalizedSectionCode
            });

            res.json({ id: this.lastID, name, level, year, section_code: normalizedSectionCode });
        }
    );
});

app.delete('/api/sections/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    db.run('DELETE FROM sections WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAction(req, req.user.id, 'section_deleted', { sectionId: req.params.id });
        res.json({ message: 'Section deleted' });
    });
});

app.get('/api/sections/:id/students', authenticateToken, (req, res) => {
    const sectionId = req.params.id;

    teacherHasAccessToSection(req.user, sectionId, (err, allowed) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!allowed) return res.status(403).json({ error: 'Access denied to this section' });

        db.all(
            'SELECT * FROM students WHERE section_id = ? ORDER BY COALESCE(list_number, 9999), name',
            [sectionId],
            (studentsErr, rows) => {
                if (studentsErr) return res.status(500).json({ error: studentsErr.message });
                res.json(rows);
            }
        );
    });
});

app.post('/api/students', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo el admin puede crear estudiantes' });

    const { name, sectionId, listNumber, studentCode } = req.body;
    const resolvedStudentCode = String(studentCode || listNumber || generateCode('EST')).trim().toUpperCase();
    const numericListNumber = listNumber ? Number(listNumber) : null;

    db.run(
        'INSERT INTO students (name, section_id, student_code, list_number) VALUES (?, ?, ?, ?)',
        [name, sectionId, resolvedStudentCode, Number.isFinite(numericListNumber) ? numericListNumber : null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAction(req, req.user.id, 'student_added', {
                studentId: this.lastID,
                name,
                sectionId,
                studentCode: resolvedStudentCode,
                listNumber: numericListNumber
            });
            res.json({
                id: this.lastID,
                name,
                section_id: sectionId,
                student_code: resolvedStudentCode,
                list_number: numericListNumber
            });
        }
    );
});

app.put('/api/students/:id/block', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo el admin puede banear estudiantes' });

    const { blocked } = req.body;
    db.run('UPDATE students SET blocked = ? WHERE id = ?', [blocked, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAction(req, req.user.id, blocked ? 'student_blocked' : 'student_unblocked', { studentId: req.params.id });
        res.json({ message: blocked ? 'Estudiante baneado' : 'Estudiante desbloqueado' });
    });
});

app.post('/api/upload-students', authenticateToken, upload.single('studentsFile'), (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo el admin puede cargar archivos de estudiantes' });
    if (!req.file) return res.status(400).json({ error: 'No se cargó ningún archivo' });

    const sectionId = req.body.sectionId;
    if (!sectionId) return res.status(400).json({ error: 'Se requiere el ID de la sección' });

    if (!isAllowedFileExtension(req.file.originalname, ['.pdf', '.docx', '.xlsx', '.xls'])) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Tipo de archivo no permitido para estudiantes' });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    processStudentsFile(req, req.file.path, fileExt, sectionId, res);
});

app.get('/api/students/:id/grades', authenticateToken, (req, res) => {
    const studentId = req.params.id;

    if (req.user.role === 'student' && String(req.user.id) !== String(studentId)) {
        return res.status(403).json({ error: 'Solo puedes ver tus propias notas' });
    }

    db.all(
        'SELECT * FROM grades WHERE student_id = ? ORDER BY subject, period',
        [studentId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

app.get('/api/student/grades', authenticateToken, (req, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Solo disponible para estudiantes' });

    db.get(
        `SELECT s.id, s.name, s.student_code, s.list_number, sec.name AS section_name, sec.section_code
         FROM students s
         JOIN sections sec ON sec.id = s.section_id
         WHERE s.id = ?`,
        [req.user.id],
        (studentErr, student) => {
            if (studentErr) return res.status(500).json({ error: studentErr.message });
            if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

            db.all(
                'SELECT subject, grade, period, updated_at FROM grades WHERE student_id = ? ORDER BY subject, period',
                [req.user.id],
                (gradesErr, grades) => {
                    if (gradesErr) return res.status(500).json({ error: gradesErr.message });
                    res.json({
                        student: {
                            id: student.id,
                            name: student.name,
                            studentCode: student.student_code,
                            listNumber: student.list_number,
                            section: student.section_name,
                            sectionCode: student.section_code
                        },
                        grades
                    });
                }
            );
        }
    );
});

app.post('/api/grades', authenticateToken, (req, res) => {
    if (!['admin', 'teacher'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });

    const { studentId, subject, grade, period } = req.body;

    if (req.user.role === 'teacher' && !teacherOwnsSubject(req.user, subject)) {
        return res.status(403).json({ error: `Solo puedes registrar notas de tu materia: ${req.user.subject}` });
    }

    db.get('SELECT section_id FROM students WHERE id = ?', [studentId], (err, student) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!student) return res.status(404).json({ error: 'Student not found' });

        if (req.user.role === 'teacher') {
            teacherHasAccessToSection(req.user, student.section_id, (sectionErr, allowed) => {
                if (sectionErr) return res.status(500).json({ error: sectionErr.message });
                if (!allowed) return res.status(403).json({ error: 'Access denied to this student' });
                saveGradeRecord();
            });
            return;
        }

        saveGradeRecord();
    });

    function saveGradeRecord() {
        db.run(
            `INSERT OR REPLACE INTO grades (student_id, subject, grade, period, teacher_id, updated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [studentId, subject, grade, period, req.user.id],
            function (saveErr) {
                if (saveErr) return res.status(500).json({ error: saveErr.message });
                logAction(req, req.user.id, 'grade_updated', { studentId, subject, grade, period });
                res.json({ message: 'Grade saved' });
            }
        );
    }
});

app.post('/api/upload-grades', authenticateToken, upload.single('gradesFile'), (req, res) => {
    if (!['admin', 'teacher'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    if (!isAllowedFileExtension(req.file.originalname, ['.csv', '.pdf', '.docx', '.xlsx', '.xls'])) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Tipo de archivo no permitido para notas' });
    }

    const sectionName = req.body.sectionName;
    const teacherArea = req.body.subject;

    if (req.user.role === 'teacher') {
        if (!teacherOwnsSubject(req.user, teacherArea)) {
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: `Solo puedes subir notas de tu materia: ${req.user.subject}` });
        }

        if (sectionName) {
            db.get('SELECT id FROM sections WHERE name = ?', [sectionName], (err, section) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!section) return res.status(400).json({ error: 'Sección no encontrada' });

                teacherHasAccessToSection(req.user, section.id, (sectionErr, allowed) => {
                    if (sectionErr) return res.status(500).json({ error: sectionErr.message });
                    if (!allowed) return res.status(403).json({ error: 'Acceso denegado a esta sección' });
                    processUploadedFile();
                });
            });
            return;
        }
    }

    processUploadedFile();

    function processUploadedFile() {
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        if (fileExt === '.csv') {
            const results = [];
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    processGradesCSV(req, results, req.user.id, res, sectionName, teacherArea, req.user);
                    fs.unlinkSync(req.file.path);
                })
                .on('error', () => {
                    res.status(500).json({ error: 'Error processing CSV' });
                });
            return;
        }

        processGradesDocument(req, req.file, req.user.id, res, sectionName, teacherArea, req.user);
    }
});

app.get('/api/grades/section/:code', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo el admin puede ver la sección completa' });

    const code = req.params.code;

    db.get('SELECT id, name, section_code FROM sections WHERE name = ? OR section_code = ?', [code, code], (err, section) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!section) return res.status(404).json({ error: 'Section not found' });

        db.all(
            `SELECT s.name, s.list_number, g.subject, g.grade, g.period, s.blocked
             FROM students s
             LEFT JOIN grades g ON s.id = g.student_id
             WHERE s.section_id = ?
             ORDER BY COALESCE(s.list_number, 9999), s.name, g.subject, g.period`,
            [section.id],
            (rowsErr, rows) => {
                if (rowsErr) return res.status(500).json({ error: rowsErr.message });

                const studentsMap = {};
                rows.forEach(row => {
                    const key = `${row.list_number || 'x'}-${row.name}`;
                    if (!studentsMap[key]) {
                        studentsMap[key] = {
                            name: row.name,
                            listNumber: row.list_number,
                            grades: [],
                            blocked: row.blocked
                        };
                    }
                    if (row.subject) {
                        studentsMap[key].grades.push({
                            subject: row.subject,
                            grade: row.grade,
                            period: row.period
                        });
                    }
                });

                res.json({ section: section.name, sectionCode: section.section_code, students: Object.values(studentsMap) });
            }
        );
    });
});

app.get('/api/sections/:id/grades-by-subject', authenticateToken, (req, res) => {
    const sectionId = req.params.id;
    const subject = req.query.subject;

    if (!subject) return res.status(400).json({ error: 'La materia es obligatoria' });

    teacherHasAccessToSection(req.user, sectionId, (err, allowed) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!allowed) return res.status(403).json({ error: 'Acceso denegado a esta sección' });
        if (req.user.role === 'teacher' && !teacherOwnsSubject(req.user, subject)) {
            return res.status(403).json({ error: `Solo puedes ver tu materia: ${req.user.subject}` });
        }

        db.get('SELECT id, name, section_code FROM sections WHERE id = ?', [sectionId], (sectionErr, section) => {
            if (sectionErr) return res.status(500).json({ error: sectionErr.message });
            if (!section) return res.status(404).json({ error: 'Sección no encontrada' });

            db.all(
                `SELECT s.id AS student_id, s.name, s.list_number, s.student_code, s.blocked, g.grade, g.period, g.updated_at
                 FROM students s
                 LEFT JOIN grades g ON g.student_id = s.id AND LOWER(g.subject) = LOWER(?)
                 WHERE s.section_id = ?
                 ORDER BY COALESCE(s.list_number, 9999), s.name, g.period`,
                [subject, sectionId],
                (gradesErr, rows) => {
                    if (gradesErr) return res.status(500).json({ error: gradesErr.message });
                    res.json({
                        section: {
                            id: section.id,
                            name: section.name,
                            sectionCode: section.section_code
                        },
                        subject,
                        students: rows.map(row => ({
                            studentId: row.student_id,
                            name: row.name,
                            listNumber: row.list_number,
                            studentCode: row.student_code,
                            blocked: row.blocked,
                            grade: row.grade,
                            period: row.period,
                            updatedAt: row.updated_at
                        }))
                    });
                }
            );
        });
    });
});

function processStudentsFile(req, filePath, fileExt, sectionId, res) {
    let extractText = () => Promise.resolve('');

    if (fileExt === '.pdf') {
        extractText = () => pdfParse(fs.readFileSync(filePath)).then(data => data.text);
    } else if (fileExt === '.docx') {
        extractText = () => mammoth.extractRawText({ path: filePath }).then(result => result.value);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        extractText = () => {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            return XLSX.utils.sheet_to_csv(sheet);
        };
    } else {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'Unsupported file type' });
    }

    extractText().then(text => {
        const names = extractNamesFromText(text);
        const added = [];
        const errors = [];

        const tasks = names.map((name, index) => {
            return new Promise(resolve => {
                const listNumber = index + 1;
                const studentCode = String(listNumber);
                db.run(
                    'INSERT INTO students (name, section_id, student_code, list_number) VALUES (?, ?, ?, ?)',
                    [name, sectionId, studentCode, listNumber],
                    function (err) {
                        if (err) {
                            errors.push(`Error adding ${name}: ${err.message}`);
                        } else {
                            added.push({ id: this.lastID, name, student_code: studentCode, list_number: listNumber });
                        }
                        resolve();
                    }
                );
            });
        });

        Promise.all(tasks).then(() => {
            fs.unlinkSync(filePath);
            logAction(req, req.user.id, 'students_uploaded', { sectionId, added: added.length, errors: errors.length });
            res.json({ message: 'Students uploaded', added, errors });
        });
    }).catch(() => {
        fs.unlinkSync(filePath);
        res.status(500).json({ error: 'Error processing file' });
    });
}

function extractNamesFromText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const names = lines.filter(line => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+$/.test(line));
    return [...new Set(names)];
}

function parseRowsFromDelimitedText(text) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map(cell => cell.trim());

    return lines.slice(1).map(line => {
        const values = line.split(delimiter).map(cell => cell.trim());
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        return row;
    });
}

function processGradesDocument(req, file, teacherId, res, sectionName, teacherArea, actor) {
    const fileExt = path.extname(file.originalname).toLowerCase();

    const finalize = (rows) => {
        fs.unlinkSync(file.path);
        processGradesCSV(req, rows, teacherId, res, sectionName, teacherArea, actor);
    };

    const fail = () => {
        fs.unlinkSync(file.path);
        res.status(500).json({ error: 'No se pudo procesar el documento de notas' });
    };

    if (fileExt === '.xlsx' || fileExt === '.xls') {
        try {
            const workbook = XLSX.readFile(file.path);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            return finalize(rows);
        } catch (error) {
            return fail();
        }
    }

    if (fileExt === '.docx') {
        mammoth.extractRawText({ path: file.path })
            .then(result => finalize(parseRowsFromDelimitedText(result.value)))
            .catch(fail);
        return;
    }

    if (fileExt === '.pdf') {
        pdfParse(fs.readFileSync(file.path))
            .then(data => finalize(parseRowsFromDelimitedText(data.text)))
            .catch(fail);
        return;
    }

    fail();
}

function processGradesCSV(req, data, teacherId, res, sectionName, teacherArea, actor) {
    const processed = [];
    const errors = [];

    const tasks = data.map((row, index) => {
        return new Promise(resolve => {
            const name = row.Nombre || row.nombre || row.Name || row.Estudiante || row.estudiante;
            const subject = teacherArea || row.Materia || row.materia || row.Subject;
            const grade = parseFloat(row.Nota || row.nota || row.Grade || row.Puntos || row.puntos);
            const period = row.Periodo || row.periodo || row.Period || row.Lapso || row.lapso || '1';
            const rowSection = row.Sección || row.seccion || row.section || row.Section || sectionName;

            if (actor.role === 'teacher' && !teacherOwnsSubject(actor, subject)) {
                errors.push(`Fila ${index + 1}: El docente solo puede subir notas de su área (${actor.subject})`);
                return resolve();
            }

            if (!name || Number.isNaN(grade)) {
                errors.push(`Fila ${index + 1}: Datos incompletos (Nombre: ${name}, Nota: ${grade})`);
                return resolve();
            }

            let sql = 'SELECT s.id, s.section_id FROM students s';
            const params = [normalize(name)];
            let where = 'LOWER(s.name) = ?';

            if (rowSection) {
                sql += ' JOIN sections sec ON s.section_id = sec.id';
                where += ' AND LOWER(sec.name) = ?';
                params.push(normalize(rowSection));
            }

            sql += ` WHERE ${where} LIMIT 1`;

            db.get(sql, params, (err, student) => {
                if (err) {
                    errors.push(`Fila ${index + 1}: Error buscando estudiante ${name}`);
                    return resolve();
                }

                if (!student) {
                    errors.push(`Fila ${index + 1}: Estudiante "${name}" no encontrado${rowSection ? ` en sección ${rowSection}` : ''}`);
                    return resolve();
                }

                if (actor.role === 'teacher') {
                    const allowed = (actor.sections || []).includes(String(student.section_id));
                    if (!allowed) {
                        errors.push(`Fila ${index + 1}: Sin acceso a la sección del estudiante ${name}`);
                        return resolve();
                    }
                }

                db.run(
                    `INSERT OR REPLACE INTO grades (student_id, subject, grade, period, teacher_id, updated_at)
                     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [student.id, subject, grade, period, teacherId],
                    insertErr => {
                        if (insertErr) {
                            errors.push(`Fila ${index + 1}: Error guardando nota para ${name}`);
                        } else {
                            processed.push({ name, subject, grade, period });
                        }
                        resolve();
                    }
                );
            });
        });
    });

    Promise.all(tasks).then(() => {
        logAction(req, teacherId, 'grades_uploaded', { processed: processed.length, errors: errors.length, subject: teacherArea });
        res.json({ message: 'Archivo procesado', processed, errors });
    });
}

app.get('/api/audit', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    db.all(
        `SELECT al.*, u.name as user_name FROM audit_log al
         LEFT JOIN users u ON al.user_id = u.id
         ORDER BY al.timestamp DESC LIMIT 100`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const logs = rows.map(row => {
                try {
                    return { ...row, details: JSON.parse(row.details || '{}') };
                } catch (e) {
                    return row;
                }
            });
            res.json(logs);
        }
    );
});

app.get('/api/students', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo el admin puede ver todos los estudiantes' });

    db.all(
        `SELECT s.*, sec.name as section_name, sec.section_code
         FROM students s
         LEFT JOIN sections sec ON s.section_id = sec.id
         ORDER BY sec.year, sec.name, COALESCE(s.list_number, 9999), s.name`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

app.post('/api/teachers', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo el admin puede crear docentes' });

    const { name, username, password, sections, subject } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const teacherCode = req.body.teacherCode || generateCode('DOC', 2);

    db.run(
        'INSERT INTO users (username, password, role, name, sections, subject, teacher_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, 'teacher', name, sections, subject, teacherCode],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAction(req, req.user.id, 'teacher_created', { teacherId: this.lastID, name, username, sections, subject, teacherCode });
            res.json({ id: this.lastID, name, username, role: 'teacher', sections, subject, teacher_code: teacherCode });
        }
    );
});

app.put('/api/students/block-by-name-year', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo el admin puede banear estudiantes' });

    const { name, year, blocked } = req.body;
    let sql = 'UPDATE students SET blocked = ? WHERE LOWER(name) = LOWER(?)';
    const params = [blocked, name];

    if (year) {
        sql = 'UPDATE students SET blocked = ? WHERE LOWER(name) = LOWER(?) AND section_id IN (SELECT id FROM sections WHERE year = ?)';
        params.push(year);
    }

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Estudiante no encontrado con esos criterios' });

        logAction(req, req.user.id, blocked ? 'student_blocked_by_name_year' : 'student_unblocked_by_name_year', { name, year });
        res.json({ message: `Se han actualizado ${this.changes} estudiante(s)` });
    });
});

app.post('/api/sections/:id/resources', authenticateToken, upload.single('resourceFile'), (req, res) => {
    const sectionId = req.params.id;
    const { subject, title } = req.body;

    if (!req.file) return res.status(400).json({ error: 'No se adjuntó ningún archivo' });
    if (!subject) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'La materia es obligatoria' });
    }
    if (!isAllowedFileExtension(req.file.originalname, ['.pdf', '.docx'])) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Solo se permiten PDF o Word (.docx)' });
    }

    teacherHasAccessToSection(req.user, sectionId, (err, allowed) => {
        if (err) {
            fs.unlinkSync(req.file.path);
            return res.status(500).json({ error: err.message });
        }
        if (!allowed) {
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: 'Acceso denegado a esta sección' });
        }
        if (req.user.role === 'teacher' && !teacherOwnsSubject(req.user, subject)) {
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: `Solo puedes subir documentos de tu materia: ${req.user.subject}` });
        }

        db.get('SELECT * FROM sections WHERE id = ?', [sectionId], (sectionErr, section) => {
            if (sectionErr || !section) {
                fs.unlinkSync(req.file.path);
                return res.status(404).json({ error: 'Sección no encontrada' });
            }

            const targetDir = path.join('sections', String(section.year || 'general'), sanitizeFileName(section.name), sanitizeFileName(subject));
            fs.mkdirSync(targetDir, { recursive: true });

            const safeName = sanitizeFileName(title || path.parse(req.file.originalname).name);
            const finalName = `${Date.now()}_${safeName}${path.extname(req.file.originalname).toLowerCase()}`;
            const finalPath = path.join(targetDir, finalName);
            fs.renameSync(req.file.path, finalPath);

            logAction(req, req.user.id, 'resource_uploaded', {
                sectionId,
                subject,
                file: finalName,
                title: title || safeName
            });

            res.json({
                message: 'Documento subido correctamente',
                resource: {
                    name: finalName,
                    title: title || safeName,
                    subject,
                    path: finalPath.replace(/\\/g, '/')
                }
            });
        });
    });
});

app.get('/api/sections/:id/files', authenticateToken, (req, res) => {
    const sectionId = req.params.id;

    teacherHasAccessToSection(req.user, sectionId, (err, allowed) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!allowed) return res.status(403).json({ error: 'Acceso denegado a esta sección' });

        db.get('SELECT * FROM sections WHERE id = ?', [sectionId], (sectionErr, section) => {
            if (sectionErr) return res.status(500).json({ error: sectionErr.message });
            if (!section) return res.status(404).json({ error: 'Sección no encontrada' });

            db.all(
                `SELECT DISTINCT g.subject
                 FROM grades g
                 JOIN students s ON g.student_id = s.id
                 WHERE s.section_id = ?
                 ORDER BY g.subject`,
                [sectionId],
                (subjectsErr, subjects) => {
                    if (subjectsErr) return res.status(500).json({ error: subjectsErr.message });

                    let filteredSubjects = subjects;
                    if (req.user.role === 'teacher') {
                        filteredSubjects = subjects.filter(item => normalize(item.subject) === normalize(req.user.subject));
                    }

                    const files = filteredSubjects.map(item => {
                        const subjectDir = path.join('sections', String(section.year || 'general'), sanitizeFileName(section.name), sanitizeFileName(item.subject));
                        const resources = fs.existsSync(subjectDir)
                            ? fs.readdirSync(subjectDir).filter(file => ['.pdf', '.docx'].includes(path.extname(file).toLowerCase())).map(file => ({
                                name: file,
                                title: file,
                                path: path.join(subjectDir, file).replace(/\\/g, '/'),
                                type: path.extname(file).toLowerCase().replace('.', '')
                            }))
                            : [];

                        return {
                            name: `Notas_${item.subject}.pdf`,
                            type: 'pdf',
                            subject: item.subject,
                            sectionName: section.name,
                            sectionCode: section.section_code,
                            date: new Date().toISOString().split('T')[0],
                            resources
                        };
                    });

                    res.json({
                        section: {
                            id: section.id,
                            name: section.name,
                            year: section.year,
                            level: section.level,
                            sectionCode: section.section_code
                        },
                        files
                    });
                }
            );
        });
    });
});

app.put('/api/teachers/:id/permissions', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo el admin puede asignar permisos' });

    const { sections, teacher_code, subject } = req.body;
    db.run(
        'UPDATE users SET sections = ?, teacher_code = ?, subject = ? WHERE id = ?',
        [sections, teacher_code, subject, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAction(req, req.user.id, 'teacher_permissions_updated', { teacherId: req.params.id, sections, teacher_code, subject });
            res.json({ message: 'Permisos de docente actualizados' });
        }
    );
});

app.get('/api/teachers', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo el admin puede ver la lista de docentes' });

    db.all('SELECT id, username, name, role, sections, subject, teacher_code FROM users WHERE role = "teacher"', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Endpoints para configuración de evaluaciones
app.get('/api/sections/:id/evaluations', authenticateToken, (req, res) => {
    const sectionId = req.params.id;
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Solo el admin puede configurar evaluaciones' });
    }
    
    db.all(
        'SELECT * FROM section_evaluations WHERE section_id = ?',
        [sectionId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

app.post('/api/sections/:id/evaluations', authenticateToken, (req, res) => {
    const sectionId = req.params.id;
    const { subject, evaluationCount } = req.body;
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Solo el admin puede configurar evaluaciones' });
    }
    
    if (!subject || !evaluationCount || ![3, 4].includes(parseInt(evaluationCount))) {
        return res.status(400).json({ error: 'Se requiere materia y número de evaluaciones (3 o 4)' });
    }
    
    db.run(
        `INSERT OR REPLACE INTO section_evaluations (section_id, subject, evaluation_count)
         VALUES (?, ?, ?)`,
        [sectionId, subject, evaluationCount],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAction(req, req.user.id, 'evaluation_config_updated', { sectionId, subject, evaluationCount });
            res.json({ message: 'Configuración de evaluaciones actualizada' });
        }
    );
});

app.get('/api/sections/:id/grades-summary', authenticateToken, (req, res) => {
    const sectionId = req.params.id;
    
    teacherHasAccessToSection(req.user, sectionId, (err, allowed) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!allowed) return res.status(403).json({ error: 'Sin acceso a esta sección' });
        
        // Obtener configuración de evaluaciones
        db.all(
            'SELECT * FROM section_evaluations WHERE section_id = ?',
            [sectionId],
            (evalErr, evalConfigs) => {
                if (evalErr) return res.status(500).json({ error: evalErr.message });
                
                const evalMap = {};
                evalConfigs.forEach(config => {
                    evalMap[config.subject.toLowerCase()] = config.evaluation_count;
                });
                
                // Obtener estudiantes y sus notas
                db.all(
                    `SELECT s.id, s.name, s.list_number, s.student_code, s.blocked,
                            g.subject, g.grade, g.period
                     FROM students s
                     LEFT JOIN grades g ON g.student_id = s.id
                     WHERE s.section_id = ?
                     ORDER BY COALESCE(s.list_number, 9999), s.name`,
                    [sectionId],
                    (gradesErr, rows) => {
                        if (gradesErr) return res.status(500).json({ error: gradesErr.message });
                        
                        // Agrupar por estudiante y materia
                        const studentsMap = {};
                        rows.forEach(row => {
                            const key = row.id;
                            if (!studentsMap[key]) {
                                studentsMap[key] = {
                                    id: row.id,
                                    name: row.name,
                                    listNumber: row.list_number,
                                    studentCode: row.student_code,
                                    blocked: row.blocked,
                                    subjects: {}
                                };
                            }
                            
                            if (row.subject) {
                                const subject = row.subject.toLowerCase();
                                if (!studentsMap[key].subjects[subject]) {
                                    studentsMap[key].subjects[subject] = {};
                                }
                                studentsMap[key].subjects[subject][row.period] = row.grade;
                            }
                        });
                        
                        // Calcular definitivas y estructurar datos
                        const students = Object.values(studentsMap).map(student => {
                            const subjectsWithGrades = {};
                            
                            Object.keys(student.subjects).forEach(subject => {
                                const grades = student.subjects[subject];
                                const evalCount = evalMap[subject] || 4;
                                const gradeValues = [];
                                
                                for (let i = 1; i <= evalCount; i++) {
                                    gradeValues.push(grades[i.toString()] || 0);
                                }
                                
                                const definitive = gradeValues.reduce((sum, grade) => sum + grade, 0) / evalCount;
                                
                                subjectsWithGrades[subject] = {
                                    grades: gradeValues,
                                    definitive: definitive.toFixed(2),
                                    evaluationCount: evalCount
                                };
                            });
                            
                            return {
                                ...student,
                                subjects: subjectsWithGrades
                            };
                        });
                        
                        res.json({
                            section: { id: sectionId },
                            evaluationConfigs: evalConfigs,
                            students: students
                        });
                    }
                );
            }
        );
    });
});

app.get('/api/planificaciones', (req, res) => {
    const dirPath = path.join(__dirname, 'planificaciones');
    if (!fs.existsSync(dirPath)) {
        return res.json([]);
    }

    fs.readdir(dirPath, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });

        const planFiles = files.filter(f => f.endsWith('.pdf')).map(f => {
            const nameParts = f.replace('.pdf', '').split('_');
            let label = f;
            let level = 'otros';

            if (nameParts.length >= 2) {
                level = nameParts[0].toLowerCase();
                const detail = nameParts[1];
                const grade = detail.match(/\d+/)?.[0] || '';
                const section = detail.match(/[A-Z]+/)?.[0] || '';

                if (level === 'primaria') {
                    label = `${grade}° Grado - Sección ${section || 'General'}`;
                } else if (level === 'bachillerato') {
                    label = `${grade}° Año - Sección ${section || 'General'}`;
                } else if (level === 'preescolar') {
                    label = `Nivel ${grade || 'Infantil'} - Sección ${section || 'General'}`;
                }
            }

            return {
                name: f,
                label: `Planificación General (${label})`,
                level,
                file: `planificaciones/${f}`
            };
        });
        res.json(planFiles);
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Algo salió mal en el servidor'
        : err.message;

    res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});
