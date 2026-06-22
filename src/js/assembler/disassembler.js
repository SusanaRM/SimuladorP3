import { REGISTER_PC, REGISTER_SP } from "./consts.js";
import { ISA } from "./isa.js";
export class Disassembler {
  constructor(simulator) {
    this._simulator = simulator;
  }

  formatRegister(r) {
    switch (r) {
      case REGISTER_SP:
        return "SP";
      case REGISTER_PC:
        return "SP";
      default:
        return "R" + r;
    }
  }

  disassemble(words) {
    let valueNextIsW = false; // marks the next address as a constant, not a instruction
    // decode the main operand
    let getOperand = (value, valueNext) => {
      let r = value & 0x0f;
      let m = (value >> 4) & 0x03;
      valueNextIsW = m === 2 || m === 3;
      switch (m) {
        case 0:
          return this.formatRegister(r);
        case 1:
          return "M[" + this.formatRegister(r) + "]";
        case 2:
          return valueNext.toString(16).padStart(4, "0") + "h";
        case 3:
          return (
            "M[" +
            this.formatRegister(r) +
            "+" +
            valueNext.toString(16).padStart(4, "0") +
            "h]"
          );
      }
    };
    // decodes instructions with 2 operands
    let getTwoOperands = (value, valueNext) => {
      let s = (value >> 9) & 0x01;
      let r = (value >> 6) & 0x07;
      if (s) {
        return this.formatRegister(r) + ", " + getOperand(value, valueNext);
      } else {
        return getOperand(value, valueNext) + ", " + this.formatRegister(r);
      }
    };

    let result = [];

    // instructions by opcode
    let opcodes = {};
    Object.keys(ISA.instance.instructions).forEach((name) => {
      let inst = ISA.instance.instructions[name];
      opcodes[inst.opcode] = inst;
    });
    // conditions by binary code
    let conditions = {};
    Object.keys(ISA.instance.conditions).forEach((cond, value) => {
      conditions[value] = cond;
    });

    let value = words[0] & 0xffff; //this._simulator._ram.readFromAddress(address) & 0xffff;
    let valueNext;
    for (let addr = 0, i = 0; i < words.length; addr++, i++) {
      valueNext = words[(addr + 1) & 0xffff] & 0xffff;
      let opcode = (value >> 10) & 0x3f;
      let inst = "";
      if (!valueNextIsW && typeof opcodes[opcode] !== "undefined") {
        let name = opcodes[opcode].name;
        let c;
        let d;
        // decode instruction by type
        switch (opcodes[opcode].type) {
          case ISA.instance.INST_TYPE_ZERO:
            inst = name;
            break;
          case ISA.instance.INST_TYPE_ZERO_CONST:
            c = value & 0x3ff;
            inst = name + " " + c;
            break;
          case ISA.instance.INST_TYPE_ONE:
            inst = name + " " + getOperand(value, valueNext);
            break;
          case ISA.instance.INST_TYPE_ONE_CONST:
            c = (value >> 6) & 0x0f;
            inst = name + " " + getOperand(value, valueNext) + ", " + c;
            break;
          case ISA.instance.INST_TYPE_TWO:
            inst = name + " " + getTwoOperands(value, valueNext);
            break;
          case ISA.instance.INST_TYPE_JUMP:
            inst = name + " " + getOperand(value, valueNext);
            break;
          case ISA.instance.INST_TYPE_JUMP_COND:
            c = (value >> 6) & 0x0f;
            inst = name + conditions[c] + " " + getOperand(value, valueNext);
            break;
          case ISA.instance.INST_TYPE_JUMP_REL:
            d = ((value & 0x3f) << 26) >> 26; // expand sign bit
            d = (addr + d + 1) & 0xffff;
            inst = name + " " + d.toString(16).padStart(4, "0") + "h";
            break;
          case ISA.instance.INST_TYPE_JUMP_REL_COND:
            c = (value >> 6) & 0x0f;
            d = ((value & 0x3f) << 26) >> 26; // expand sign bit
            d = (addr + d + 1) & 0xffff;
            inst =
              name +
              conditions[c] +
              " " +
              d.toString(16).padStart(4, "0") +
              "h";
            break;
        }
      } else {
        valueNextIsW = false;
      }
      result.push({ addr, value, inst });
      value = valueNext;
    }
    return result;
  }
}
