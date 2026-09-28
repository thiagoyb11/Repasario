"""Construye el banco editable a partir de las preguntas originales y las nuevas."""

from pathlib import Path
import json
import re


ROOT = Path(__file__).resolve().parents[1]
originals = json.loads((ROOT / "tools" / "originales_extraidas.json").read_text(encoding="utf-8"))
bank = []


def topic(text):
    s = text.casefold()
    if any(x in s for x in ("arquitectura", "capa", "mvc")):
        return "Arquitectura y MVC"
    if any(x in s for x in ("patrón", "patron", "factory", "builder", "strategy", "state", "singleton", "observer", "decorator", "dao")):
        return "Patrones de diseño"
    if any(x in s for x in ("excepción", "excepcion", "throw", "catch", "finally")):
        return "Excepciones"
    if any(x in s for x in ("archivo", "file", "stream", "reader", "writer", "byte")):
        return "Entrada y salida"
    if any(x in s for x in ("colección", "coleccion", "iterator", "arraylist", "hashset", "list<", "set<", "stringbuffer")):
        return "Colecciones y cadenas"
    if any(x in s for x in ("interfaz", "interface", "abstract", "paquete")):
        return "Interfaces y paquetes"
    if any(x in s for x in ("clase", "objeto", "método", "metodo", "constructor", "herencia", "subclase", "superclase", "encapsulación")):
        return "Clases y objetos"
    return "Fundamentos de Java"


for i, q in enumerate(originals, 1):
    if i == 8:
        # FileReader también decodifica bytes: extiende InputStreamReader.
        q = {**q,
             "pregunta": "¿Cuáles de estas clases permiten leer caracteres a partir de bytes de un archivo?",
             "opciones": ["InputStreamReader", "FileReader", "OutputStreamWriter", "FileOutputStream"],
             "correctas": [0, 1],
             "explicacion": "InputStreamReader convierte bytes en caracteres y FileReader, que lo extiende, lee caracteres desde un archivo."}
    explanation = q["explicacion"]
    if explanation in ("Respuesta correcta", "Respuesta incorrecta", "Respuesta parcialmente correcta", "Correct answer", "Incorrect answer", "Partially correct answer", ""):
        explanation = "La respuesta correcta es: " + "; ".join(q["opciones"][j] for j in q["correctas"]) + "."
    bank.append({
        "id": f"original-{i:03d}",
        "pregunta": q["pregunta"],
        "opciones": q["opciones"],
        "correctas": q["correctas"],
        "explicacion": explanation,
        "tema": topic(q["pregunta"]),
        "origen": "Original del cuestionario",
        "fuente": q["fuente"],
    })


def add(stem, options, correct, explanation, section, source, adapted=False):
    bank.append({
        "id": f"nueva-{len(bank) - len(originals) + 1:03d}",
        "pregunta": stem,
        "opciones": options,
        "correctas": correct if isinstance(correct, list) else [correct],
        "explicacion": explanation,
        "tema": section,
        "origen": "Adaptada de emparejamiento" if adapted else "Pregunta nueva",
        "fuente": source,
    })


# Las cuatro actividades de emparejamiento se expresan como 12 preguntas de selección.
for stem, options, correct, explanation, section in [
    ("En un bloque de manejo de excepciones, ¿qué parte se ejecuta normalmente exista o no una excepción?", ["try", "catch", "finally", "throw"], 2, "finally se ejecuta después de try/catch, salvo terminaciones extraordinarias de la JVM.", "Excepciones"),
    ("¿Qué bloque define cómo manejar un tipo concreto de excepción?", ["catch", "try", "finally", "throws"], 0, "catch captura y maneja las excepciones compatibles con su parámetro.", "Excepciones"),
    ("¿Qué bloque contiene el código que puede lanzar una excepción?", ["finally", "try", "catch", "throw"], 1, "El código que puede fallar se coloca en try.", "Excepciones"),
    ("En una arquitectura multicapa, ¿qué capa accede al almacenamiento de información?", ["Presentación", "Negocio", "Datos"], 2, "La capa de datos concentra el acceso y la gestión del almacenamiento.", "Arquitectura y MVC"),
    ("En una arquitectura multicapa, ¿qué capa interactúa directamente con el usuario?", ["Datos", "Presentación", "Negocio"], 1, "La presentación recibe acciones y muestra resultados al usuario.", "Arquitectura y MVC"),
    ("En una arquitectura multicapa, ¿qué capa aplica reglas y procesa información?", ["Negocio", "Datos", "Presentación"], 0, "La lógica de negocio implementa las reglas del dominio.", "Arquitectura y MVC"),
    ("¿Qué patrón cambia su comportamiento según un estado interno?", ["Singleton", "State", "Observer", "Iterator"], 1, "State delega el comportamiento al objeto que representa el estado actual.", "Patrones de diseño"),
    ("¿Qué patrón permite recorrer una colección sin exponer su estructura interna?", ["Observer", "Iterator", "Decorator", "Singleton"], 1, "Iterator ofrece una interfaz de recorrido independiente de la representación de la colección.", "Patrones de diseño"),
    ("¿Qué patrón busca asegurar una única instancia de una clase?", ["Strategy", "State", "Singleton", "Observer"], 2, "Singleton controla la creación y el acceso a una única instancia.", "Patrones de diseño"),
    ("¿Qué patrón notifica cambios a varios objetos suscritos?", ["Observer", "Decorator", "Iterator", "Factory"], 0, "Observer mantiene suscriptores y les comunica cambios.", "Patrones de diseño"),
    ("¿En qué patrón se configura normalmente el algoritmo concreto desde el exterior?", ["State", "Strategy", "Observer"], 1, "Strategy permite sustituir una estrategia mediante configuración o inyección.", "Patrones de diseño"),
    ("¿En qué patrón la transición suele depender del estado interno del objeto?", ["Strategy", "Decorator", "State"], 2, "State modela estados y sus transiciones de comportamiento.", "Patrones de diseño"),
]:
    add(stem, options, correct, explanation, section, "Cuestionarios originales", adapted=True)


GROUPS = {
    "Fundamentos de Java": ("Intro-java.pdf", [
        ("¿Qué herramienta del JDK transforma un archivo .java en bytecode?", ["java", "javac", "jar", "javadoc"], 1, "javac compila el código fuente y produce archivos .class."),
        ("¿Qué comando ejecuta una clase Java que contiene main?", ["javac Main", "java Main", "java Main.java.class", "run Main"], 1, "java inicia la JVM y ejecuta la clase indicada."),
        ("¿Cuál es el tipo primitivo apropiado para almacenar true o false?", ["Boolean", "bool", "boolean", "String"], 2, "boolean es el tipo primitivo de valores lógicos."),
        ("¿Qué imprime System.out.println(7 / 2) cuando ambos operandos son int?", ["3", "3.5", "4", "Error de compilación"], 0, "La división entre enteros descarta la parte fraccionaria."),
        ("¿Qué expresión compara el contenido de dos String de forma habitual?", ["a == b", "a.equals(b)", "a = b", "a.compareTo(b) == 1"], 1, "equals compara el contenido de las cadenas; == compara referencias."),
        ("¿Cuál de estas declaraciones crea un arreglo de tres enteros?", ["int[] a = new int[3];", "int a = new int[3];", "int[] a = int[3];", "array<int> a = 3;"], 0, "new int[3] reserva un arreglo de longitud tres."),
        ("¿Qué valor inicial tienen los elementos de un arreglo nuevo de int?", ["null", "-1", "0", "No tienen valor"], 2, "Los elementos int de un arreglo se inicializan con cero."),
        ("¿Qué característica permite ejecutar el mismo bytecode en sistemas con una JVM compatible?", ["La portabilidad de la JVM", "El nombre del archivo", "La clase String", "El compilador C"], 0, "La JVM interpreta o compila el bytecode para la plataforma donde corre."),
    ]),
    "Clases y objetos": ("CyO-java.pdf; CyO-java-2.pdf", [
        ("¿Qué representa un objeto respecto de su clase?", ["Una instancia de la clase", "Un paquete", "Un archivo fuente", "Un método estático"], 0, "Un objeto es una instancia creada según la definición de una clase."),
        ("¿Qué miembro se comparte entre todas las instancias de una clase?", ["Un campo local", "Un campo static", "Un parámetro", "Un campo de instancia"], 1, "Los campos static pertenecen a la clase."),
        ("¿Qué hace this dentro de un método de instancia?", ["Se refiere al objeto actual", "Crea un objeto nuevo", "Invoca la superclase", "Finaliza el método"], 0, "this permite referirse a la instancia sobre la que se invoca el método."),
        ("¿Qué sucede si una clase no declara ningún constructor?", ["Siempre falla al compilar", "Java aporta un constructor sin argumentos", "Todos sus campos se vuelven static", "La clase se vuelve abstracta"], 1, "El compilador agrega un constructor por defecto sin argumentos."),
        ("¿Qué instrucción crea una instancia de Persona si existe Persona()?", ["Persona p = Persona();", "Persona p = new Persona();", "new Persona p;", "Persona.new();"], 1, "new invoca el constructor y devuelve una referencia."),
        ("¿Qué modificador limita el acceso a un campo a su propia clase?", ["public", "protected", "private", "static"], 2, "private restringe el acceso directo a la clase que declara el campo."),
        ("¿Qué ocurre con una variable local antes de asignarle un valor?", ["Vale null", "Vale cero", "No se puede leer", "Vale false"], 2, "El compilador exige asignación definitiva antes de leer una variable local."),
        ("¿Qué llamada a constructor debe ser la primera sentencia de otro constructor?", ["this(...) o super(...)", "println(...) ", "return", "new(...)"], 0, "La invocación explícita de this(...) o super(...) debe aparecer primero."),
    ]),
    "Interfaces y paquetes": ("Clases-abstractas-interfaces-paquetes.pdf", [
        ("¿Se puede crear directamente new Figura() si Figura es abstract?", ["Sí, siempre", "Sí, si no declara métodos", "No", "Solo desde main"], 2, "Una clase abstracta no puede instanciarse directamente."),
        ("¿Qué palabra usa una clase para declarar que implementa una interfaz?", ["extends", "implements", "interface", "import"], 1, "implements declara la relación de implementación."),
        ("¿Qué palabra usa una interfaz para heredar otra interfaz?", ["implements", "extends", "super", "package"], 1, "Las interfaces pueden extender otras interfaces."),
        ("¿Qué debe hacer una subclase concreta con los métodos abstractos heredados?", ["Implementarlos", "Convertirlos en campos", "Eliminarlos", "Declararlos private"], 0, "Una clase concreta implementa los métodos abstractos pendientes."),
        ("¿Qué sentencia declara el paquete al que pertenece un archivo fuente Java?", ["import", "module", "package", "classpath"], 2, "package ubica la unidad de compilación en un espacio de nombres."),
        ("¿Cuál es una ventaja de usar una interfaz como tipo de una variable?", ["Permite referirse a distintas implementaciones", "Elimina la necesidad de objetos", "Hace todos los métodos privados", "Convierte la variable en primitiva"], 0, "El código depende del contrato y puede recibir implementaciones diferentes."),
        ("¿Qué permite una clase abstracta además de declarar métodos abstractos?", ["Solo constantes", "Campos, constructores y métodos concretos", "Instanciación directa", "Herencia múltiple de clases"], 1, "Una clase abstracta también puede compartir estado y comportamiento concreto."),
        ("¿Qué modificador impide que una clase tenga subclases?", ["abstract", "final", "static", "protected"], 1, "Una clase final no puede extenderse."),
    ]),
    "Colecciones y cadenas": ("Colecciones-java.pdf", [
        ("¿Qué interfaz representa una secuencia que permite elementos repetidos?", ["Set", "List", "Map", "Queue"], 1, "List conserva una secuencia de elementos y admite repetidos."),
        ("¿Qué colección evita elementos duplicados según equals/hashCode?", ["ArrayList", "HashSet", "LinkedList", "StringBuilder"], 1, "HashSet mantiene elementos únicos según igualdad y hash."),
        ("¿Qué método devuelve la cantidad de elementos de una List?", ["length", "size()", "count()", "capacity()"], 1, "Las colecciones usan size(); los arreglos usan el campo length."),
        ("¿Qué método se usa normalmente para agregar un elemento a una List?", ["put", "append", "add", "insert"], 2, "La interfaz List hereda add de Collection."),
        ("¿Qué expresión obtiene el primer elemento de una List<String> llamada lista?", ["lista[0]", "lista.get(0)", "lista.first()", "lista.next()"], 1, "get(0) accede al elemento de índice cero."),
        ("¿Qué método de String compara contenido sin distinguir mayúsculas?", ["equalsIgnoreCase", "compare", "same", "=="], 0, "equalsIgnoreCase compara ignorando las diferencias de mayúsculas."),
        ("¿Qué clase permite modificar una secuencia de caracteres sin crear un String por cada cambio?", ["StringBuffer", "Character", "Integer", "String"], 0, "StringBuffer mantiene contenido mutable."),
        ("¿Qué llamada elimina de forma segura el último elemento obtenido por un Iterator?", ["lista.remove(0)", "it.remove()", "it.delete()", "it.next(null)"], 1, "Iterator.remove elimina el elemento entregado por la última llamada a next()."),
    ]),
    "Excepciones": ("Excepciones-java.pdf", [
        ("¿Qué palabra lanza explícitamente un objeto de excepción?", ["throws", "catch", "throw", "finally"], 2, "throw lanza una instancia de Throwable o una subclase."),
        ("¿Qué palabra declara en la firma las excepciones que un método puede propagar?", ["throw", "throws", "try", "catch"], 1, "throws aparece en la firma del método."),
        ("¿Qué tipo de excepción debe normalmente capturarse o declararse?", ["Checked exception", "RuntimeException", "Error", "NullPointerException"], 0, "Las excepciones checked están sujetas al control del compilador."),
        ("¿Qué excepción produce normalmente un acceso a un objeto mediante una referencia null?", ["IOException", "NullPointerException", "ClassCastException", "ArithmeticException"], 1, "Desreferenciar null provoca NullPointerException."),
        ("¿Qué bloque puede manejar IOException lanzada dentro de try?", ["catch (IOException e)", "finally (IOException e)", "throws (IOException e)", "throw IOException"], 0, "catch recibe la excepción de tipo compatible."),
        ("¿Qué construccion cierra automáticamente recursos que implementan AutoCloseable?", ["try-with-resources", "if-else", "switch", "for-each"], 0, "try-with-resources invoca close al salir del bloque."),
        ("¿Qué ocurre cuando una excepción no se captura en el método actual?", ["Se propaga al llamador", "Se convierte en cero", "Siempre se ignora", "Se reinicia la JVM"], 0, "La búsqueda de un manejador continúa por la pila de llamadas."),
        ("¿Qué categoría representa problemas graves que normalmente una aplicación no recupera?", ["Error", "IOException", "Exception", "RuntimeException"], 0, "Error representa fallos serios de la JVM o del entorno."),
    ]),
    "Entrada y salida": ("Cuestionarios originales", [
        ("¿Qué flujo se usa para leer bytes de un archivo binario?", ["FileInputStream", "FileReader", "FileWriter", "PrintWriter"], 0, "FileInputStream lee bytes del archivo."),
        ("¿Qué flujo se usa para escribir bytes en un archivo binario?", ["FileReader", "FileOutputStream", "BufferedReader", "Scanner"], 1, "FileOutputStream escribe bytes."),
        ("¿Qué clase lee caracteres de un archivo usando una codificación de caracteres?", ["FileReader", "FileInputStream", "DataOutputStream", "ObjectOutputStream"], 0, "FileReader trabaja con caracteres; en código nuevo también puede elegirse una codificación explícita."),
        ("¿Qué clase agrega búfer a la lectura de bytes?", ["BufferedInputStream", "StringBuilder", "FileWriter", "OutputStreamWriter"], 0, "BufferedInputStream reduce lecturas pequeñas del flujo subyacente."),
        ("¿Qué tipo de flujo convierte bytes en caracteres?", ["InputStreamReader", "OutputStreamWriter", "FileOutputStream", "BufferedOutputStream"], 0, "InputStreamReader decodifica bytes a caracteres."),
        ("¿Qué tipo de flujo convierte caracteres en bytes?", ["InputStreamReader", "OutputStreamWriter", "FileInputStream", "BufferedReader"], 1, "OutputStreamWriter codifica caracteres como bytes."),
        ("¿Qué método de BufferedReader devuelve una línea de texto?", ["nextLine()", "readLine()", "readText()", "getLine()"], 1, "readLine() lee una línea o devuelve null al finalizar."),
        ("¿Qué valor devuelve read() de un InputStream al llegar al fin del flujo?", ["null", "0", "-1", "false"], 2, "read() devuelve -1 para indicar fin del flujo."),
    ]),
    "Arquitectura y MVC": ("MVC.pdf; arquitecturas.pdf", [
        ("En MVC, ¿qué componente representa los datos y reglas del dominio?", ["Vista", "Controlador", "Modelo", "Router"], 2, "El modelo contiene las entidades y lógica del dominio."),
        ("En MVC, ¿qué componente presenta información al usuario?", ["Vista", "Modelo", "Controlador", "DAO"], 0, "La vista se ocupa de mostrar la información."),
        ("En MVC, ¿qué componente recibe acciones del usuario y coordina la respuesta?", ["Modelo", "Controlador", "Base de datos", "Repositorio"], 1, "El controlador interpreta la entrada y coordina modelo y vista."),
        ("¿Qué principio central propone MVC?", ["Separar responsabilidades", "Guardar todo en una clase", "Evitar interfaces", "Usar solo una capa"], 0, "MVC organiza modelo, vista y controlador en responsabilidades distintas."),
        ("¿Qué describe la vista estática de una arquitectura?", ["Los componentes y sus relaciones", "Solo el tiempo de respuesta", "Únicamente las pantallas", "El historial de errores"], 0, "La vista estática muestra los elementos y relaciones estructurales."),
        ("¿Qué restricción no funcional puede influir en una arquitectura?", ["Disponibilidad", "Nombre de una variable local", "Color de un comentario", "Orden de imports"], 0, "La disponibilidad es un atributo de calidad que influye en el diseño."),
        ("¿Qué capa conviene que concentre las reglas del dominio en una arquitectura multicapa?", ["Presentación", "Negocio", "Datos", "Interfaz gráfica"], 1, "La capa de negocio aplica las reglas del dominio."),
        ("¿Por qué se usan interfaces entre capas?", ["Para reducir el acoplamiento", "Para eliminar todos los objetos", "Para evitar pruebas", "Para forzar variables globales"], 0, "Los contratos permiten cambiar una implementación con menos impacto en otras capas."),
    ]),
    "Patrones de diseño": ("Cuestionarios originales; arquitecturas.pdf", [
        ("¿Qué patrón encapsula la creación de objetos detrás de una operación?", ["Factory", "Observer", "State", "Iterator"], 0, "Factory concentra la decisión de qué objeto crear."),
        ("¿Qué patrón construye un objeto complejo mediante pasos configurables?", ["Builder", "Singleton", "Observer", "State"], 0, "Builder separa la construcción paso a paso del objeto resultante."),
        ("¿Qué patrón agrega comportamiento envolviendo un objeto existente?", ["Decorator", "DAO", "Iterator", "Factory"], 0, "Decorator envuelve un componente y añade responsabilidades."),
        ("¿Qué patrón abstrae operaciones de acceso a datos?", ["DAO", "State", "Observer", "Builder"], 0, "DAO encapsula el acceso y la persistencia de datos."),
        ("¿Qué patrón permite intercambiar algoritmos que comparten un contrato?", ["Strategy", "Singleton", "Observer", "Factory"], 0, "Strategy encapsula algoritmos intercambiables."),
        ("¿Qué elemento recibe avisos del sujeto en Observer?", ["El observador suscrito", "El compilador", "El constructor", "El iterador"], 0, "El sujeto notifica a los observadores registrados."),
        ("¿Cuál es un riesgo de usar Singleton para estado mutable compartido?", ["Acoplamiento global difícil de probar", "Necesidad de un arreglo", "Imposibilidad de métodos", "Compilación más lenta siempre"], 0, "Un estado global compartido dificulta aislar pruebas y dependencias."),
        ("¿Qué diferencia principal hay entre Strategy y State?", ["Strategy selecciona algoritmos; State modela cambios ligados al estado", "Strategy solo sirve para archivos", "State no usa interfaces", "Son idénticos en intención"], 0, "Aunque su estructura se parece, sus objetivos son distintos."),
    ]),
}

for section, (source, questions) in GROUPS.items():
    for stem, options, correct, explanation in questions:
        add(stem, options, correct, explanation, section, source)

assert len(originals) == 74, len(originals)
assert len(bank) == 150, len(bank)
assert len({q["id"] for q in bank}) == len(bank)
(ROOT / "preguntas.json").write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Banco creado: {len(originals)} originales + 12 adaptadas + 64 nuevas = {len(bank)}")
