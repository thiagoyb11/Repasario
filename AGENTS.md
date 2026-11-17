# AGENTS.md

## Commits

Los mensajes de commit siguen [Conventional Commits 1.0.0](https://www.conventionalcommits.org/es/v1.0.0/).

```text
<tipo>(<alcance opcional>): <descripción>

<cuerpo opcional>

<pie opcional>
```

### Tipos

| Tipo | Uso |
| --- | --- |
| `feat` | Funcionalidad nueva para el usuario. |
| `fix` | Corrección de un error. |
| `docs` | Solo documentación (README, AGENTS.md, comentarios). |
| `refactor` | Cambio de código que no agrega funcionalidad ni corrige errores. |
| `perf` | Mejora de rendimiento. |
| `test` | Agregar o corregir pruebas (`src/**/*.test.ts`). |
| `build` | Compilación, dependencias y PWA: `package.json`, `vite.config.ts`, `tsconfig.json`. |
| `chore` | Mantenimiento que no encaja en los anteriores (`.gitignore`, configuración). |
| `content` | Cambios en la materia de ejemplo de `public/ejemplos/`. |

### Alcances sugeridos

`domain` (lógica en `src/domain/`), `db` (base de datos local en `src/db/`), `ui` (interfaz en `src/components/`, `src/pages/` y `src/lib/`), `ejemplos` o el identificador de la materia de ejemplo (`diseno-sistemas-p2`) y `build`.

### Reglas

- La descripción va en español, en modo imperativo y en minúscula, sin punto final, y con 72 caracteres como máximo en total en la primera línea. Ejemplo: `feat(domain): mezclar las opciones de cada pregunta`.
- Un commit por cambio lógico. No mezclar, por ejemplo, un cambio de código con un cambio en la materia de ejemplo.
- El cuerpo es opcional, va separado por una línea en blanco y explica qué cambia y por qué.
- Un cambio incompatible (por ejemplo, en el formato JSON de las materias o de la copia de seguridad) se marca con `!` después del tipo o el alcance (`feat(db)!: ...`) y con un pie `BREAKING CHANGE: <descripción>`.

### Ejemplos

```text
feat(domain): mezclar las opciones de cada pregunta al azar
fix(ui): mostrar la explicación en preguntas de varias respuestas
content(diseno-sistemas-p2): agregar preguntas de patrones de diseño
docs: documentar el campo mezclar en el README
build: actualizar vite a la versión 6
test(db): cubrir la restauración de la copia de seguridad
```
