# Transcripciones preliminares para evaluación OCR

Seis recortes asociados al manifiesto. Ninguno está validado por una persona. Se excluyen las anotaciones docentes. Se preserva el contenido sin corregir respuestas; las lecturas dudosas y la notación matemática requieren revisión. Saltos de línea aproximados. Las etiquetas entre corchetes son editoriales, no texto de la imagen.

## EX_0001 · P1 · inciso —

Región: `cdb17d4124a5402e82f852f146306d89`. Página original: 3. Orden: 1.

```text
1) a) Se Trata de un autómata Con Pila No determinista
b) La traduccion es:
δ(q₃, λ, A) = (q₇, BB)
A := BB
c) q₃ —[λ, A/BB]→ q₇
d) Seria no determinista, Ya que al leer el Símbolo de pila “A” Voy a Tener
2 opciones de derivación “BB” con λ y “A” con la entrada de “a”
e) (q₃, aba, AAA#)
q₃: estado
aba: cadena a ser leida
[ilegible: notación debajo de «ser leida»]
AAA#: lo que Se encuentra en la pila
[ilegible: expresión de pertenencia debajo de «pila»]
#: simbolo fin de Pila
```

Dudas para revisión:

- δ: El símbolo inicial de la función es tenue; lectura tentativa δ.
- A := BB: Comprobar autoría: inscripción negra rodeada en rojo; se conserva provisionalmente como texto del estudiante.
- No determinista: Texto negro rodeado por el docente; se conserva el texto negro.
- e): Diagrama espacial convertido a pares etiqueta/explicación. Revisar las dos expresiones inferiores, parcialmente ilegibles.

## EX_0004 · P1 · inciso —

Región: `e2689d8163c949cea93bddb64a80a544`. Página original: 21. Orden: 1.

```text
1) a) se refiere a un Automata Pila
b) f(q₃, λ, [dudoso: Aλ]) = (q₇, BB, [dudoso: Aλ])
c) q₃ —[λ, A BB]→ q₇
d) Si el movimiento (q₃, aba, AAA#) ⊢ (q₇, ba, AAA#)
es válido la máquina sigue siendo determinista porque
para ser No determinista debería cumplirse que para
una misma entrada se pueda definir dos o mas posibles
transiciones y realizar diferentes acciones.
En este caso son entradas distintas,
(q₃, aba, AAA#) ⊢ (q₇, aba, BBAA#) no lee nada y apila
 y (q₃, aba, AAA#) ⊢ (q₇, ba, AAA#) lee el simbolo ‘a’
y no apila.
e) q₃: estado actual
aba: cadena a leer
AAA#: contenido de la pila
```

Dudas para revisión:

- b): Los símbolos que siguen a A, rodeados por correcciones rojas, no son inequívocos. No se eliminan los componentes incorrectos de la fórmula.
- c): No se distingue con seguridad un separador entre A y BB; se mantiene un espacio.
- d): Comprobar índices de estados y orientación exacta del símbolo de movimiento. Se representa como ⊢ sin corregir el razonamiento.

## EX_0002 · P6 · inciso b

Región: `f81a64f8d20f4baa868b6890c4d6e18f`. Página original: 11. Orden: 1.

```text
Se utiliza para especificar las gramáticas de los lenguajes de progra-
mación comerciales.

Además sirven para hacer un análisis semántico guiado por la
sintaxis de las gramáticas del lenguaje.
```

Dudas para revisión:

- guiado: Lectura probable de palabra manuscrita; revisar contra la imagen.
- Inicio: Se omite el marcador de inciso de color verde por posible autoría docente; revisar si debe formar parte del objetivo OCR.

## EX_0002 · P3 · inciso —

Región: `282bc2b6bf044fe689e36bcf7cbd7d2e`. Página original: 9. Orden: 1.

```text
El preanálisis es una técnica de programación que se utiliza para que un
 autómata con pila no determinista se comporte de manera determinística.
Esto implica conocer los próximos k símbolos a ser leídos por el autómata.
para poder predecir cual de las posibles producciones pueden llegar
 a conducir a la aceptación.

En otras palabras, consiste en ver dos o más símbolos (leer, preana-
lizar) para determinar cual es la producción que podría utilizarse
frente a alternativas no determinísticas.
```

Dudas para revisión:

- consiste: Palabra sobrescrita; lectura tentativa «consiste».
- Inicio: Se omite el número 3 verde por posible autoría docente.
- Acentos: Revisar las tildes en «leídos», «producción» y «podría»: trazos pequeños y tenues.

## EX_0004 · P6 · inciso —

Región: `5a8caee959fb4099a2a51cc5152281bb`. Página original: 24. Orden: 1.

```text
6) a) Una gramática con atributos es una gramática en la
que le asignan propiedades o atributos a los simbolos
terminales y no terminales, tambien se agregan restricciones
 a las producciones y condiciones a las producciones.
GA = (Σₜ, Σₙ, S, P, A, R, C)    S: el axioma.
P: conjunto de producciones.
A: conjunto de atributos de los Σₜ y Σₙ
R: conjunto de restricciones de P
C: conjunto de condiciones de P

b) se utiliza para definir semanticas de los lenguajes.

c) Un atributo es una propiedad [inserción: o más] que se le designa a los
simbolos (Terminales y No terminales), son caracteristicas que
 deben cumplir los simbolos.

d) Se clasifican en
Estáticos: porque se calculan en tiempo de compilación
Dinámicos: porque se calculan durante la ejecución
```

Dudas para revisión:

- GA: Los paréntesis rojos son del docente y se excluyen; los paréntesis de la transcripción solo linealizan la tupla.
- c): Inserción superior «o más»; confirmar el punto de inserción. Hay sobrescritura al final de «propiedad».
- b): Lectura tentativa «semanticas»; no se agrega la continuación roja del docente.

## EX_0004 · P4 · inciso —

Región: `2f4973e1cc694034812703ba2b59fef9`. Página original: 22. Orden: 1.

```text
4) α#β → α#β=x
Ej [dudoso: b̅] 0110#11011[dudoso: b̅] → [dudoso: b̅]0110#11011=10110[dudoso: b̅]

a) α ∈ Σ* con Σ = {0, 1, #} alfabeto de entrada

b) β ∈ Γ*    Γ = Σ ∪ {[dudoso: b̅]} ∪ Ω    alfabeto de la cinta.
Ω es un conjunto de simbolos auxiliares y a priori
[ilegible: inicio de línea] tiene el simbolo = y podria tener mas simbolos
auxiliares si es necesario para resolver la operacion.
[dudoso: b̅] es blanco
Σ el alfabeto de entrada.

c) Sea n = |α|, α [ilegible] cadena a leer
α = β#γ    donde m = |β| = |γ|
entonces n = 2m + 1
La cantidad de celdas que se ocupará para escribir
el resultado de la [dudoso: ejecución] de la operacion es 1 por el
simbolo =, más la longitud de la cadena resultado (σ)
esta longitud ocupará el mismo espacio que β y γ
=> m = |σ| = |β| = |γ|
Entonces el espacio ocupado total en la cinta sera.
2m + 1 + 1 + m    n = 2m + 1 => m = (n−1)/2
por lo cual E(n) = 2((n−1)/2) + 1 + 1 + (n−1)/2 = n + n/2 + 1 = 3n/2 + 1
```

Dudas para revisión:

- Encabezado: Fórmula y ejemplo escritos a lápiz: revisar caracteres, especialmente blanco, cadena resultado y signo igual.
- b̅: Representación tentativa del símbolo manuscrito de blanco; podría ser otra notación. No se normaliza a un símbolo distinto.
- α, β, γ, σ: Letras griegas tentativas; algunas se parecen entre sí. Revisar todas las fórmulas.
- c): Texto tapado por material claro. No se completa por contexto.
- E(n): Se conserva la igualdad final tal como se lee, sin corregir aritmética. Revisar constantes y fracciones.

