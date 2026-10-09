# ADR-0013: Estilo visual y paleta de colores

- **Estado:** Aceptado
- **Fecha:** 2026-10-09

## Contexto

Marisa pidió una estética en **azules, grises y blancos**. Los gráficos de torta (hasta 6
categorías) necesitan colores que se distingan entre sí, también para personas con
daltonismo. Se validaron candidatas con el validador de paletas (separación para daltonismo
y visión normal, contraste, en modo claro y oscuro):

| Orden probado                                                     | Claro    | Oscuro   |
| ----------------------------------------------------------------- | -------- | -------- |
| azul, verde agua, violeta, amarillo, rosa, naranja                | Falla    | Falla    |
| azul, violeta, verde agua, rosa, amarillo, naranja                | Falla    | Falla    |
| azul, verde agua, violeta, naranja, rosa, amarillo                | Falla    | Falla    |
| **azul, naranja, verde agua, amarillo, rosa, verde** (referencia) | **Pasa** | **Pasa** |

Una paleta solo de azules y grises no puede pasar: los grises no tienen saturación suficiente
para identificar una categoría y los azules entre sí se confunden.

## Decisión

- **Interfaz** (fondos, tarjetas, bordes, textos, botones, foco): azules, grises y blancos.
  Modo claro con fondo casi blanco y modo oscuro con fondo casi negro.
- **Barras** (la mayoría de los gráficos): un solo azul, porque son una sola serie.
- **Tendencia:** creados en azul (serie 1) y resueltos en naranja (serie 2) de la paleta
  validada, con etiquetas directas.
- **Tortas y gráfico por estado:** la paleta categórica de referencia validada (empieza en
  azul), con versión propia para modo oscuro. El color sigue a la entidad, no a su posición.
- **Gráfico por estado:** las barras se ordenan por cantidad, así que cualquier par de grupos
  puede quedar contiguo (se valida "todos contra todos"). Con cinco colores la validación
  falla en modo oscuro (rosa vs. verde agua para daltonismo; violeta vs. azul). Por eso solo
  tres grupos llevan color —En curso (azul), En espera (naranja), Completado (verde agua),
  validado todos contra todos en ambos modos— y Por hacer, Descartado y Sin clasificar van en
  grises. Cada barra muestra además el nombre de su grupo en texto.
- Los colores de aviso (advertencia, error) se reservan para alertas y siempre van con ícono y
  texto.
- Tres colores de la paleta quedan por debajo de 3:1 de contraste en modo claro; por eso las
  tortas llevan leyenda con valores y cada gráfico tiene vista de tabla.

## Consecuencias

- El dashboard se ve predominantemente azul, gris y blanco; los otros tonos aparecen solo en
  tortas y en la segunda línea de la tendencia.
- Cambiar la paleta exige volver a correr el validador en modo claro y oscuro.
