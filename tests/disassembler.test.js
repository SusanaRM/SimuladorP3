import { Disassembler } from "../src/js/assembler/disassembler";
import { Assembler } from "../src/js/assembler/assembler.js";

describe("Disassembler", () => {
  let disassembler;
  let assembler;

  beforeEach(() => {
    disassembler = new Disassembler();
    assembler = new Assembler();
  });

  test("disassembles MOV immediate", () => {
    const code = "MOV R1, R2";
    const our = assembler.assemble(code);
    const ourBinary = Array.from(new Uint16Array(our.buildProgramCode()));
    const result = disassembler.disassemble(ourBinary);

    expect(result[4].inst).toEqual(code);
  });
});
