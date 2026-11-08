import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:tls";
import { describe, expect, it, vi } from "vitest";
import { nifValido } from "@/lib/dominio/nif";

vi.mock("server-only", () => ({}));
const { comprobarCertificado, nifDelSujeto } = await import("@/lib/servidor/certificado");

describe("NIF", () => {
  it("valida DNI, NIE y NIF de sociedades con su control", () => {
    expect(nifValido("12345678Z")).toBe(true);
    expect(nifValido("12345678-z")).toBe(true);
    expect(nifValido("12345678A")).toBe(false);
    expect(nifValido("X1234567L")).toBe(true);
    expect(nifValido("B00000000")).toBe(true);
    expect(nifValido("B00000001")).toBe(false);
    expect(nifValido("Q2826000H")).toBe(true);
    expect(nifValido("")).toBe(false);
  });

  it("saca el NIF de los campos de un certificado español", () => {
    expect(nifDelSujeto({ serialNumber: "IDCES-12345678Z", CN: "X" })).toBe("12345678Z");
    expect(
      nifDelSujeto({ organizationIdentifier: "VATES-B00000000", serialNumber: "IDCES-1" }),
    ).toBe("B00000000");
    expect(nifDelSujeto({ CN: "GARCIA PEREZ ANA - 12345678Z" })).toBe("12345678Z");
  });
});

// Un certificado de cliente de mentira (.p12) y un servidor TLS que lo pide, como la AEAT.
const dir = mkdtempSync(path.join(tmpdir(), "cert-"));
const ssl = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
let hayOpenssl = true;
try {
  ssl(
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "srv.key",
    "-out",
    "srv.crt",
    "-days",
    "2",
    "-subj",
    "/CN=localhost",
  );
  ssl(
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "cli.key",
    "-out",
    "cli.crt",
    "-days",
    "30",
    "-subj",
    "/CN=BAR DE PRUEBA - B00000000/serialNumber=IDCES-12345678Z/2.5.4.97=VATES-B00000000",
  );
  ssl(
    "pkcs12",
    "-export",
    "-inkey",
    "cli.key",
    "-in",
    "cli.crt",
    "-out",
    "cli.p12",
    "-passout",
    "pass:secreta",
  );
} catch {
  hayOpenssl = false;
}

describe.skipIf(!hayOpenssl)("certificado y conexión", () => {
  it("abre el .p12, dice de quién es y cuándo caduca, y conecta", async () => {
    const servidor = createServer(
      {
        key: readFileSync(path.join(dir, "srv.key")),
        cert: readFileSync(path.join(dir, "srv.crt")),
        requestCert: true,
        rejectUnauthorized: false,
      },
      (s) => s.end(),
    );
    await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
    const puerto = (servidor.address() as { port: number }).port;
    const p12 = readFileSync(path.join(dir, "cli.p12")).toString("base64");
    const ca = readFileSync(path.join(dir, "srv.crt"));
    const url = `https://localhost:${puerto}/`;
    try {
      const bien = await comprobarCertificado(p12, "secreta", url, { ca });
      expect(bien).toMatchObject({ abre: true, conecta: true, nif: "B00000000" });
      expect(bien.titular).toContain("BAR DE PRUEBA");
      const dias = (Date.parse(bien.caduca!) - Date.now()) / 86_400_000;
      expect(dias).toBeGreaterThan(28);

      const mal = await comprobarCertificado(p12, "otra", url, { ca });
      expect(mal).toMatchObject({ abre: false, conecta: false });
      expect(mal.error).toContain("contraseña");
    } finally {
      servidor.close();
    }
  });
});
