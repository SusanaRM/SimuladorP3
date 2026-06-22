import { Assembler } from "../src/js/assembler/assembler.js";
import { CPU } from "../src/js/cpu-core/cpu.js";
import { Memory } from "../src/js/memory-system/memory.js";

describe("CPU", () => {
  let cpu = new CPU();
  let memoryInstance;
  let assembler;

  beforeEach(() => {
    memoryInstance = new Memory();
    cpu = new CPU(memoryInstance);
    assembler = new Assembler();

    memoryInstance.reset();

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

  test("executes ADD instruction", () => {
    cpu.hardwareRegisters[1] = 5;
    cpu.hardwareRegisters[2] = 3;

    const code = `ADD R1, R2`;
    assembleAndRun(code);

    expect(cpu.registers.R1).toBe(8);
  });

  test("executes MOV with immediate value", () => {
    const code = `MOV R1, 42`;
    assembleAndRun(code);

    expect(cpu.registers.R1).toBe(42);
  });

  test("can instantiate independent memory for multiple CPUs", () => {
    const memoryA = new Memory();
    const memoryB = new Memory();
    const cpuA = new CPU(memoryA);
    const cpuB = new CPU(memoryB);

    memoryA.write(0, 0x1234);
    expect(memoryB.read(0)).toBe(0);
    expect(memoryA.read(0)).toBe(0x1234);
    expect(cpuA.memorySubsystem).not.toBe(cpuB.memorySubsystem);
  });

  test("executes PUSH/POP stack operations", () => {
    cpu.registers.R1 = 123;
    cpu.registers.SP = 100;

    const codePush = `PUSH R1`;
    assembleAndRun(codePush);

    expect(cpu.registers.SP).not.toBe(100);
    expect(cpu.registers.SP).toBe(99);

    expect(memoryInstance.memory[cpu.registers.SP + 1]).toBe(123);

    const codePop = `POP R1`;
    assembleAndRun(codePop);

    expect(cpu.registers.R1).toBe(123);
  });
});
