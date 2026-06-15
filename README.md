# UECP - Sistema para Colegio Privado Nuestros Simbolos

## Cosas que hacer

- [ ] Documentar todo lo que se necesita hacer para el proyecto.
##  Sistema de Autenticación y Seguridad

El acceso al sistema no requiere un registro tradicional de correo y contraseña, sino que se basa en un esquema de **códigos únicos** para garantizar la privacidad y la carga ágil de datos:

* **Alumnos:** Ingresan utilizando su **Código de Sección + Nombre**. Esto garantiza que un alumno solo pueda visualizar sus propias notas y no las de sus compañeros.
* **Docentes:** Ingresan mediante un **Código de Docente** único, el cual les otorga permisos de edición exclusivos para su materia asignada.
* **Administradores:** El sistema cuenta con **tres (3) códigos de administrador** maestros predefinidos para el control total de la plataforma.

---

##  Roles y Funcionalidades

###  Administrador (Admin)
Tiene control total sobre la estructura física y lógica de la plataforma. Sus funciones incluyen:
*  **Crear carpetas:** Organización de los directorios del sistema por períodos académicos, años o secciones.
*  **Asignar docentes:** Vinculación de los profesores a sus respectivas materias y carpetas.
*  **Historial de cambios:** Registro de auditoría para visualizar qué modificaciones se han hecho en el sistema, por quién y cuándo.
*  **Banear alumnos:** Restricción de acceso a estudiantes por motivos administrativos o disciplinarios.

###  Docente
Su entorno de trabajo está limitado estrictamente a sus responsabilidades académicas:
*  **Gestión de Notas:** Añadir, editar y guardar las calificaciones de los estudiantes. Una vez guardadas, quedan disponibles para el alumno.
*  **Acceso Restringido:** El docente **solo** tendrá acceso a la materia y carpeta que el administrador le haya asignado explícitamente. No puede ver ni modificar carpetas de otros colegas.

###  Alumno
Un entorno de consulta privada y directa:
*  **Visualización de Notas:** Consulta de calificaciones en tiempo real, restringida únicamente a su perfil mediante el filtro de sección y nombre.
*  **Control de Estado:** El alumno **solo podrá ver sus notas si no está baneado** por el administrador. De lo contrario, el acceso quedará bloqueado.

---

##  Módulo de Planificaciones

El sistema cuenta con una sección global de **Planificaciones Académicas**:
*  **Visualización Pública/General:** Todas las planificaciones de las materias deben ser visibles para los usuarios correspondientes, permitiendo un seguimiento del cronograma escolar, objetivos y evaluaciones planificadas para el lapso.

