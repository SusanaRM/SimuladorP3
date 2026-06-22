import { ISA } from "./isa.js";

// Instruction class
export class Instruction {
  isa = ISA.instance;
  constructor(useDebug) {
    this.debug = useDebug ? { text: null, line: null, addr: 0 } : null;
    this.label = null;
    this.name = "nop";
    this.condition = null;
    this.operands = [];
  }

  isPseudoInstruction() {
    return !!this.isa.pseudoInstructions[this.name];
  }

  isInstruction() {
    return !!this.isa.instructions[this.name];
  }

  requiresLabel() {
    if (this.isPseudoInstruction()) {
      return this.isa.pseudoInstructions[this.name].requiresLabel;
    }
    return false;
  }

  getOpcode() {
    return this.isInstruction()
      ? this.isa.instructions[this.name].opcode
      : null;
  }

  getType() {
    if (this.isPseudoInstruction()) {
      return this.isa.pseudoInstructions[this.name].type;
    } else if (this.isInstruction()) {
      return this.isa.instructions[this.name].type;
    }
    return null;
  }

  getConditionCode() {
    let c = this.isa.conditions[this.condition];
    return c === undefined ? null : c;
  }

  getNumOperands() {
    const type = this.getType();
    if (type === "0") return 0;
    if (type === "0c") return 1;
    if (type === "1") return 1;
    if (type === "1c") return 2;
    if (type === "2") return 2;
    if (type.charAt(0) === "j") return 1;
    return null;
  }
}
