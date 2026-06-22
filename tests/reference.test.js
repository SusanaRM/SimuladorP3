import { Assembler } from "../src/js/assembler/assembler.js";
import { CPU } from "../src/js/cpu-core/cpu.js";
import { Memory } from "../src/js/memory-system/memory.js";

let fs = require("fs");

// Path to reference p3js project (currently is expected to be sibling of this project's path)
let p3js = require("../../p3js/src/p3js");

describe("Reference P3 CPU", () => {
  let assembler;

  let cpu = new CPU();
  let memoryInstance;
  let refCpu = new p3js.Simulator();

  beforeEach(() => {
    assembler = new Assembler();

    memoryInstance = new Memory();
    cpu = new CPU(memoryInstance);
    memoryInstance.reset();

    refCpu = new p3js.Simulator();
  });

  function assemble(code) {
    const result = assembler.assemble(code);
    memoryInstance.load(Array.from(new Uint16Array(result.buffer)));
    return result;
  }

  function assembleAndRun(code) {
    const result = assemble(code);
    cpu.step();
    cpu.step();
    return result;
  }

  function stepInstructionRef() {
    const instruction = refCpu._cpu._instructionCount;
    while (refCpu._cpu._instructionCount == instruction) refCpu._cpu.clock();
  }

  describe("Reference Assembler Comparison", () => {
    test("Basic MOV instruction", async () => {
      const code = "MOV R1, R2";
      let our = assembler.assemble(code);
      let ourBinary = Array.from(new Uint16Array(our.buildProgramCode()));
      let ref = p3js.assembly.assembleWithDefaultValidator(code);
      let refBinary = Array.from(new Uint16Array(ref.buildProgramCode()));
      expect(ourBinary).toEqual(refBinary);
    });

    test("demo-ist program", () => {
      const demoPath = "./tests/example-programs/demo-ist.as";
      if (!fs.existsSync(demoPath)) return; // skip if file doesn't exist
      let demoCode = fs.readFileSync(demoPath, "utf8");

      let our = assembler.assemble(demoCode);
      let ourBinary = Array.from(new Uint16Array(our.buildProgramCode()));
      let ref = p3js.assembly.assembleWithDefaultValidator(demoCode);
      let refBinary = Array.from(new Uint16Array(ref.buildProgramCode()));
      expect(ourBinary).toEqual(refBinary);
    });

    test("Simple arithmetic program", async () => {
      const code = `MOV R0, 5
ADD R0, 3
SUB R0, 2
CMP R0, 6`;
      let our = assembler.assemble(code);
      let ref = p3js.assembly.assembleWithDefaultValidator(code);
      expect(Array.from(new Uint16Array(our.buildProgramCode()))).toEqual(
        Array.from(new Uint16Array(ref.buildProgramCode())),
      );
    });

    test("Branch instruction offsets", async () => {
      const code = `MOV R0, 10
BR LABEL
LABEL: RET`;
      let our = assembler.assemble(code);
      let ref = p3js.assembly.assembleWithDefaultValidator(code);
      expect(Array.from(new Uint16Array(our.buildProgramCode()))).toEqual(
        Array.from(new Uint16Array(ref.buildProgramCode())),
      );
    });

    test("Pseudo-instructions", async () => {
      const code = `ORIG 2000h
    MSG STR 'Hello'
    SPACE TAB 8`;
      let our = assembler.assemble(code);
      let ref = p3js.assembly.assembleWithDefaultValidator(code);
      expect(Array.from(new Uint16Array(our.buildProgramCode()))).toEqual(
        Array.from(new Uint16Array(ref.buildProgramCode())),
      );
    });

    test("Indexed addressing", async () => {
      const code = `DATA WORD 1234h
MOV R3, M[R4+DATA]`;
      let our = assembler.assemble(code);
      let ref = p3js.assembly.assembleWithDefaultValidator(code);
      expect(Array.from(new Uint16Array(our.buildProgramCode()))).toEqual(
        Array.from(new Uint16Array(ref.buildProgramCode())),
      );
    });

    test("Rotate instructions", async () => {
      const code = `ROR R7, 5
ROL R0, 3`;
      let our = assembler.assemble(code);
      let ref = p3js.assembly.assembleWithDefaultValidator(code);
      expect(Array.from(new Uint16Array(our.buildProgramCode()))).toEqual(
        Array.from(new Uint16Array(ref.buildProgramCode())),
      );
    });

    test("Conditional jumps", async () => {
      const code = `MOV R0, 5
BR.NZ LABEL1
LABEL1: RET`;
      let our = assembler.assemble(code);
      let ref = p3js.assembly.assembleWithDefaultValidator(code);
      expect(Array.from(new Uint16Array(our.buildProgramCode()))).toEqual(
        Array.from(new Uint16Array(ref.buildProgramCode())),
      );
    });

    test("String operations", async () => {
      const code = `MSG STR 'P3'
    MOV R0, MSG`;
      let our = assembler.assemble(code);
      let ref = p3js.assembly.assembleWithDefaultValidator(code);
      expect(Array.from(new Uint16Array(our.buildProgramCode()))).toEqual(
        Array.from(new Uint16Array(ref.buildProgramCode())),
      );
    });

    test("Direct addressing", async () => {
      const code = `DATA WORD 55h
MOV R3, M[0]`;
      let our = assembler.assemble(code);
      let ref = p3js.assembly.assembleWithDefaultValidator(code);
      expect(Array.from(new Uint16Array(our.buildProgramCode()))).toEqual(
        Array.from(new Uint16Array(ref.buildProgramCode())),
      );
    });

    test("Relative jump", async () => {
      const code = `MOV R0, 1
BR LABEL
LABEL: RET`;
      let our = assembler.assemble(code);
      let ref = p3js.assembly.assembleWithDefaultValidator(code);
      expect(Array.from(new Uint16Array(our.buildProgramCode()))).toEqual(
        Array.from(new Uint16Array(ref.buildProgramCode())),
      );
    });
  });

  describe("Reference CPU comparison tests", () => {
    test("simple mov", () => {
      const code = `MOV R1, 42`;
      const result = assembleAndRun(code);
      refCpu.loadMemory(result.buffer);

      for (let i = 0; i < result.instructionCount + 1; i++) {
        cpu.step();
        stepInstructionRef();
      }

      expect(refCpu._cpu._registers[1]).toBe(42);
      expect(cpu.registers.R1).toBe(42);
    });

    test("IST Demo", () => {
      const toHex = (value) => {
        return "0x" + value.toString(16).toUpperCase().padStart(4, "0");
      };

      const demoPath = "./tests/example-programs/demo-ist.as";
      if (!fs.existsSync(demoPath)) return; // skip if file doesn't exist
      let demoCode = fs.readFileSync(demoPath, "utf8");

      const result = assemble(demoCode);
      refCpu.loadMemory(result.buffer);

      for (let i = 0; i < 500; i++) {
        try {
          cpu.step();
          stepInstructionRef();

          const pcHex = toHex(cpu.registers.PC);
          const pcHexRef = toHex(refCpu._cpu.PC);

          expect(cpu.hardwareRegisters).toEqual(refCpu._cpu._registers);
          expect(pcHex).toBe(pcHexRef);
          expect(cpu.registers.R1).toBe(refCpu._cpu._registers[1] & 0xffff);
        } catch (error) {
          error.message = `[Failed at instruction index: ${i}, PC: ${cpu.registers.PC} Ref: ${refCpu._cpu.PC}] ${error.message}`;
          throw error;
        }
      }
    });
  });
});
