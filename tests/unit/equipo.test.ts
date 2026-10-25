import { describe, expect, it } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import {
  fichaPersonal,
  filasRegistro,
  formatearMinutos,
  informePorCamarero,
  instante,
  lunesDe,
  minutosTrabajados,
  minutosTurno,
  resumenJornada,
  sinSalida,
  situacion,
} from "@/lib/dominio/equipo";
import { rangoDeDias } from "@/lib/dominio/informes";
import { cuentaDeMesa, reducirPersonal } from "@/lib/dominio/reducir";
import type { Empleado, Estado } from "@/lib/dominio/tipos";
import { vistaPersonal } from "@/lib/servidor/vistas";
import { contexto } from "./ayuda";

const ctx = contexto();

/** Un estado de ejemplo y una forma de hacer cosas a una hora concreta. */
function preparar() {
  let estado: Estado = estadoDeEjemplo(ctx);
  const [ana, luis, marta] = estado.empleados as [Empleado, Empleado, Empleado];
  const hacer = (accion: AccionPersonal, quien: Empleado, ahora = ctx.ahora) => {
    estado = reducirPersonal(estado, accion, quien, { ...ctx, ahora }).estado;
  };
  return {
    get estado() {
      return estado;
    },
    hacer,
    ana,
    luis,
    marta,
  };
}

const a = (hora: string) => `2026-10-27T${hora}:00.000Z`;

describe("fichar", () => {
  it("entrada, descanso, vuelta y salida, con las horas sin el descanso", () => {
    const t = preparar();
    t.hacer({ tipo: "fichar", que: "entrada" }, t.luis, a("09:00"));
    expect(situacion(t.estado.fichajes, t.luis.id, a("09:30")).situacion).toBe("trabajando");
    t.hacer({ tipo: "fichar", que: "pausa" }, t.luis, a("13:00"));
    expect(situacion(t.estado.fichajes, t.luis.id, a("13:10")).situacion).toBe("descanso");
    t.hacer({ tipo: "fichar", que: "vuelta" }, t.luis, a("13:30"));
    t.hacer({ tipo: "fichar", que: "salida" }, t.luis, a("17:00"));
    const [f] = t.estado.fichajes;
    expect(f).toMatchObject({ entrada: a("09:00"), salida: a("17:00") });
    expect(minutosTrabajados(f!, a("20:00"))).toBe(7 * 60 + 30);
    expect(situacion(t.estado.fichajes, t.luis.id, a("17:05")).situacion).toBe("fuera");
  });

  it("no deja fichar dos entradas ni salir sin haber entrado", () => {
    const t = preparar();
    expect(() => t.hacer({ tipo: "fichar", que: "salida" }, t.luis)).toThrow(/entrada/);
    t.hacer({ tipo: "fichar", que: "entrada" }, t.luis, a("09:00"));
    expect(() => t.hacer({ tipo: "fichar", que: "entrada" }, t.luis, a("10:00"))).toThrow(
      /Ya fichaste la entrada \(10:00\)/,
    );
    expect(() => t.hacer({ tipo: "fichar", que: "vuelta" }, t.luis, a("10:00"))).toThrow(
      /descanso/,
    );
  });

  it("salir en mitad del descanso cierra el descanso", () => {
    const t = preparar();
    t.hacer({ tipo: "fichar", que: "entrada" }, t.marta, a("09:00"));
    t.hacer({ tipo: "fichar", que: "pausa" }, t.marta, a("12:00"));
    t.hacer({ tipo: "fichar", que: "salida" }, t.marta, a("12:20"));
    expect(t.estado.fichajes[0]!.pausas).toEqual([{ inicio: a("12:00"), fin: a("12:20") }]);
  });

  it("una entrada olvidada de ayer no impide entrar hoy, y sale como «sin salida»", () => {
    const t = preparar();
    t.hacer({ tipo: "fichar", que: "entrada" }, t.luis, "2026-10-26T09:00:00.000Z");
    t.hacer({ tipo: "fichar", que: "entrada" }, t.luis, a("09:00"));
    expect(t.estado.fichajes).toHaveLength(2);
    expect(sinSalida(t.estado.fichajes, a("10:00")).map((f) => f.entrada)).toEqual([
      "2026-10-26T09:00:00.000Z",
    ]);
  });
});

describe("corregir fichajes", () => {
  it("el encargado corrige y queda anotado qué había antes", () => {
    const t = preparar();
    t.hacer({ tipo: "fichar", que: "entrada" }, t.luis, a("09:00"));
    const id = t.estado.fichajes[0]!.id;
    t.hacer(
      {
        tipo: "corregir_fichaje",
        fichajeId: id,
        empleadoId: t.luis.id,
        entrada: a("09:00"),
        salida: a("17:00"),
        pausas: [],
        motivo: "Se le olvidó fichar la salida",
      },
      t.ana,
      a("18:00"),
    );
    expect(t.estado.fichajes[0]).toMatchObject({
      salida: a("17:00"),
      cambios: [
        {
          por: t.ana.id,
          motivo: "Se le olvidó fichar la salida",
          antes: { entrada: a("09:00"), salida: null, pausas: [] },
        },
      ],
    });
  });

  it("apuntar a mano un día entero deja claro que no se fichó", () => {
    const t = preparar();
    t.hacer(
      {
        tipo: "corregir_fichaje",
        empleadoId: t.marta.id,
        entrada: a("16:00"),
        salida: a("23:00"),
        pausas: [{ inicio: a("19:00"), fin: a("19:30") }],
        motivo: "La tablet no funcionaba",
      },
      t.ana,
      a("23:30"),
    );
    expect(t.estado.fichajes[0]!.cambios![0]!.antes).toBeNull();
  });

  it("no acepta salidas antes de la entrada, horas futuras ni descansos fuera", () => {
    const t = preparar();
    const base = {
      tipo: "corregir_fichaje" as const,
      empleadoId: t.luis.id,
      pausas: [],
      motivo: "Prueba",
    };
    expect(() =>
      t.hacer({ ...base, entrada: a("10:00"), salida: a("09:00") }, t.ana, a("20:00")),
    ).toThrow(/después de la entrada/);
    expect(() =>
      t.hacer({ ...base, entrada: a("10:00"), salida: a("21:00") }, t.ana, a("20:00")),
    ).toThrow(/aún no han pasado/);
    expect(() =>
      t.hacer(
        {
          ...base,
          entrada: a("10:00"),
          salida: a("12:00"),
          pausas: [{ inicio: a("13:00"), fin: a("13:30") }],
        },
        t.ana,
        a("20:00"),
      ),
    ).toThrow(/dentro de la jornada/);
  });

  it("solo el encargado corrige", () => {
    const t = preparar();
    expect(() =>
      t.hacer(
        {
          tipo: "corregir_fichaje",
          empleadoId: t.luis.id,
          entrada: a("09:00"),
          salida: a("17:00"),
          pausas: [],
          motivo: "Me lo pongo yo",
        },
        t.luis,
        a("18:00"),
      ),
    ).toThrow(/encargado/);
  });
});

describe("cuadrante", () => {
  it("guarda turnos, copia la semana sin repetir y calcula las horas", () => {
    const t = preparar();
    const lunes = lunesDe("2026-11-04");
    expect(lunes).toBe("2026-11-02");
    t.hacer(
      {
        tipo: "guardar_turno",
        turno: {
          empleadoId: t.luis.id,
          dia: "2026-11-03",
          desde: "20:00",
          hasta: "01:00",
          puesto: "",
        },
      },
      t.ana,
    );
    const antes = t.estado.cuadrante.length;
    t.hacer({ tipo: "copiar_semana", desde: "2026-11-02", hacia: "2026-11-09" }, t.ana);
    expect(t.estado.cuadrante.some((x) => x.dia === "2026-11-10" && x.desde === "20:00")).toBe(
      true,
    );
    expect(() =>
      t.hacer({ tipo: "copiar_semana", desde: "2026-11-02", hacia: "2026-11-09" }, t.ana),
    ).toThrow(/No hay turnos nuevos/);
    expect(t.estado.cuadrante.length).toBe(antes + 1);
    expect(minutosTurno({ desde: "20:00", hasta: "01:00" })).toBe(300);
  });

  it("el ejemplo trae turnos de esta semana y la que viene, sin lunes", () => {
    const { cuadrante } = estadoDeEjemplo(ctx);
    expect(cuadrante.length).toBeGreaterThan(20);
    expect(cuadrante.some((x) => new Date(`${x.dia}T12:00:00Z`).getUTCDay() === 1)).toBe(false);
  });

  it("compara las horas fichadas con las previstas", () => {
    const t = preparar();
    t.hacer(
      {
        tipo: "guardar_turno",
        turno: {
          empleadoId: t.luis.id,
          dia: "2026-10-27",
          desde: "10:00",
          hasta: "17:00",
          puesto: "",
        },
      },
      t.ana,
    );
    t.hacer({ tipo: "fichar", que: "entrada" }, t.luis, instante("2026-10-27", "10:00"));
    t.hacer({ tipo: "fichar", que: "salida" }, t.luis, instante("2026-10-27", "17:30"));
    const estado = {
      ...t.estado,
      cuadrante: t.estado.cuadrante.filter((x) => !x.id.startsWith("tc-")),
    };
    const luis = resumenJornada(estado, "2026-10-26", "2026-11-01", a("20:00")).find(
      (r) => r.empleado.id === t.luis.id,
    );
    expect(luis).toMatchObject({ dias: 1, trabajados: 450, previstos: 420, abiertos: 0 });
  });
});

describe("informe por camarero y registro", () => {
  it("cuenta ventas, propinas, anulaciones, invitaciones y horas de cada uno", () => {
    const t = preparar();
    t.hacer({ tipo: "abrir_caja", fondoInicial: 0 }, t.ana);
    const mesa = t.estado.mesas[0]!;
    t.hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 2 }, t.luis);
    const cuentaId = cuentaDeMesa(t.estado, mesa.id)!.id;
    t.hacer(
      {
        tipo: "anotar",
        cuentaId,
        lineas: [
          { productoId: "prod-1-1", cantidad: 2, opciones: [], nota: "" },
          { productoId: "prod-5-2", cantidad: 1, opciones: [], nota: "" },
          { productoId: "prod-8-2", cantidad: 1, opciones: [], nota: "" },
        ],
      },
      t.luis,
    );
    t.hacer({ tipo: "enviar_comanda", cuentaId }, t.luis);
    const [caña, bravas, flan] = cuentaDeMesa(t.estado, mesa.id)!.lineas;
    t.hacer({ tipo: "invitar_linea", cuentaId, lineaId: flan!.id, invitacion: true }, t.luis);
    t.hacer({ tipo: "anular_linea", cuentaId, lineaId: bravas!.id, motivo: "Se ha caído" }, t.ana);
    // Quitar la invitación la borra del informe; volver a ponerla la apunta otra vez.
    t.hacer({ tipo: "invitar_linea", cuentaId, lineaId: flan!.id, invitacion: false }, t.luis);
    t.hacer({ tipo: "invitar_linea", cuentaId, lineaId: flan!.id, invitacion: true }, t.luis);
    t.hacer(
      { tipo: "cobrar", cuentaId, pagos: [{ metodo: "tarjeta", importe: 450 }], propina: 50 },
      t.luis,
    );
    void caña;
    const r = informePorCamarero(t.estado, rangoDeDias("2026-10-01", "2026-12-31"), a("23:00"));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      empleado: { nombre: "Luis" },
      ventas: 400,
      tickets: 1,
      propinas: 50,
      anulaciones: 1,
      importeAnulado: 550,
      invitaciones: 1,
      importeInvitado: 450,
    });
  });

  it("quitar una línea sin mandar no cuenta como anulación", () => {
    const t = preparar();
    const mesa = t.estado.mesas[0]!;
    t.hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 1 }, t.luis);
    const cuentaId = cuentaDeMesa(t.estado, mesa.id)!.id;
    t.hacer(
      {
        tipo: "anotar",
        cuentaId,
        lineas: [{ productoId: "prod-1-1", cantidad: 1, opciones: [], nota: "" }],
      },
      t.luis,
    );
    const linea = cuentaDeMesa(t.estado, mesa.id)!.lineas[0]!;
    t.hacer({ tipo: "anular_linea", cuentaId, lineaId: linea.id, motivo: "Error" }, t.luis);
    expect(t.estado.incidencias).toEqual([]);
  });

  it("el registro en CSV lleva horas, descansos y correcciones", () => {
    const t = preparar();
    t.hacer({ tipo: "fichar", que: "entrada" }, t.luis, instante("2026-10-27", "10:00"));
    t.hacer({ tipo: "fichar", que: "pausa" }, t.luis, instante("2026-10-27", "14:00"));
    t.hacer({ tipo: "fichar", que: "vuelta" }, t.luis, instante("2026-10-27", "14:30"));
    t.hacer({ tipo: "fichar", que: "salida" }, t.luis, instante("2026-10-27", "18:00"));
    const filas = filasRegistro(t.estado.fichajes, t.estado.empleados, a("23:00"));
    expect(filas[1]).toEqual(["Luis", "2026-10-27", "10:00", "18:00", 30, 7.5, ""]);
  });

  it("escribe las horas para personas", () => {
    expect(formatearMinutos(450)).toBe("7 h 30 min");
    expect(formatearMinutos(45)).toBe("45 min");
    expect(formatearMinutos(-120)).toBe("−2 h");
  });
});

describe("lo que ve cada uno", () => {
  it("al fichar: cómo está, su turno de hoy y sus horas de la semana", () => {
    const t = preparar();
    t.hacer(
      {
        tipo: "guardar_turno",
        turno: {
          empleadoId: t.luis.id,
          dia: "2026-10-27",
          desde: "10:00",
          hasta: "14:00",
          puesto: "Sala",
        },
      },
      t.ana,
    );
    t.hacer({ tipo: "fichar", que: "entrada" }, t.luis, instante("2026-10-27", "10:00"));
    t.hacer({ tipo: "fichar", que: "pausa" }, t.luis, instante("2026-10-27", "12:00"));
    const ficha = fichaPersonal(t.estado, t.luis.id, instante("2026-10-27", "12:15"));
    expect(ficha).toMatchObject({
      situacion: "descanso",
      desde: instante("2026-10-27", "12:00"),
      semana: { trabajados: 120 },
    });
    expect(ficha.hoy).toContainEqual({ desde: "10:00", hasta: "14:00", puesto: "Sala" });
  });

  it("un camarero solo recibe sus fichajes; el encargado, los de todos", () => {
    const t = preparar();
    const ahora = Date.parse(a("12:00"));
    t.hacer({ tipo: "fichar", que: "entrada" }, t.luis, a("09:00"));
    t.hacer({ tipo: "fichar", que: "entrada" }, t.marta, a("09:05"));
    const deLuis = vistaPersonal(t.estado, "local", t.luis, ahora);
    expect(deLuis.fichajes.map((f) => f.empleadoId)).toEqual([t.luis.id]);
    const deAna = vistaPersonal(t.estado, "local", t.ana, ahora);
    expect(deAna.fichajes).toHaveLength(2);
  });
});
