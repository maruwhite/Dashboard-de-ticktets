# ADR-0011: Reparto de personas y equipo ficticio de responsables

- **Estado:** Aceptado
- **Fecha:** 2026-10-09
- **Reemplaza:** el punto 2 de [ADR-0010](0010-ajustes-etapas-2-a-4.md)

## Contexto

Con la primera anonimización (8 personas con usuario propio y el resto agrupado en
`Usuario 9`), un solo usuario concentraba el 48 % de los tickets como informador. Además, el
export tiene **una única persona asignada** en todos los tickets, así que el gráfico por
responsable tendría una sola barra. Como las personas se guardan como texto (ADR-0010), ya no
hay límite de licencias de Jira.

## Decisión

1. **Informadores y responsables de proyecto → hasta 20 usuarios inventados**
   (`Usuario 1` … `Usuario 20`). La misma persona real es siempre el mismo usuario. Si hay
   más personas que usuarios, se reparten para **equilibrar la carga**: de la más frecuente a
   la menos frecuente, cada persona va al usuario con menos apariciones acumuladas.
   `Usuario 1` es el de más apariciones.
2. **Responsable → equipo ficticio de 5 agentes** (`Agente 1` … `Agente 5`), asignados con
   un reparto desigual (32/26/20/14/8 %) mediante un generador pseudoaleatorio con semilla
   fija, para que el resultado sea igual en cada ejecución.

## Consecuencias

- **El responsable de cada ticket no es un dato real.** Hay que aclararlo en el README y en la
  presentación del challenge; el resto de los campos sí refleja los datos reales
  (anonimizados).
- Varias personas reales pueden compartir un usuario inventado, así que el gráfico por
  informador muestra grupos, no individuos. Es aceptable: el objetivo es la forma de la
  distribución, no identificar personas.
