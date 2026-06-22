//Work in progress
// Debugger - Step execution control
export class Debugger {
    constructor(cpu) {
        this.cpu = cpu;
        this.breakpoints = [];
    }

    stepInstruction() {
        const opcode = this.cpu.readMemory(this.cpu.registers.PC);
        // Execute instruction and update state
    }

    run() {
        // Continuous execution loop
    }
}