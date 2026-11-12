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
| `test` | Agregar o corregir pruebas (`tools/smoke_*.py`). |
| `build` | Compilación y empaquetado: `tools/build_desktop.py`, `release/`, `Repasario-portable.zip`, `requirements-build.txt`. |
| `chore` | Mantenimiento que no encaja en los anteriores (`.gitignore`, configuración). |
| `content` | Cambios en los bancos de preguntas de `materias/`. |

### Alcances sugeridos

`app` (servidor y corrección en `app.py`), `web` (interfaz en `web/`), `mcp` (`mcp_server.py`, `.mcp.json`), `materias` o el identificador de una materia (por ejemplo `diseno-sistemas-p2`), `build` y `tools`.

### Reglas

- La descripción va en español, en modo imperativo y en minúscula, sin punto final, y con 72 caracteres como máximo en total en la primera línea. Ejemplo: `feat(app): mezclar las opciones de cada pregunta`.
- Un commit por cambio lógico. No mezclar, por ejemplo, un cambio de código con la regeneración de un banco de preguntas.
- El cuerpo es opcional, va separado por una línea en blanco y explica qué cambia y por qué.
- Un cambio incompatible (por ejemplo, en el formato de los JSON de `materias/`) se marca con `!` después del tipo o el alcance (`feat(app)!: ...`) y con un pie `BREAKING CHANGE: <descripción>`.

### Ejemplos

```text
feat(app): mezclar las opciones de cada pregunta al azar
fix(web): mostrar la explicación en preguntas de varias respuestas
content(diseno-sistemas-p2): agregar preguntas de patrones de diseño
docs: documentar el campo mezclar en el README
build: actualizar la versión compilada para macOS
test(app): cubrir la mezcla de opciones en el test de humo
```
