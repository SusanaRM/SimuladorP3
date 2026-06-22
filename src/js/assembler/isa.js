export class ISA {
  static instance = new ISA();

  constructor() {
    this.INST_TYPE_ZERO = "0"; // zero operands
    this.INST_TYPE_ZERO_CONST = "0c"; // zero operands with constant
    this.INST_TYPE_ONE = "1"; // one operand
    this.INST_TYPE_ONE_CONST = "1c"; // one operand with constant
    this.INST_TYPE_TWO = "2"; // two operands
    this.INST_TYPE_JUMP = "j"; // absolute jump
    this.INST_TYPE_JUMP_COND = "jc"; // conditional absolute jump
    this.INST_TYPE_JUMP_REL = "jr"; // relative jump
    this.INST_TYPE_JUMP_REL_COND = "jrc"; // conditional relative jump

    this.pseudoInstructions = {
      ORIG: { type: "0c", requiresLabel: false },
      EQU: { type: "0c", requiresLabel: true },
      WORD: { type: "0c", requiresLabel: true },
      STR: { type: "s", requiresLabel: true },
      TAB: { type: "0c", requiresLabel: true },
    };

    this.instructions = {};

    this.conditions = {
      Z: 0,
      NZ: 1,
      C: 2,
      NC: 3,
      N: 4,
      NN: 5,
      O: 6,
      NO: 7,
      P: 8,
      NP: 9,
      I: 10,
      NI: 11,
    };

    this.resetInstructions();
  }

  registerInstruction(name, opcode, type) {
    this.instructions[name] = { name, opcode, type };
  }

  resetInstructions() {
    [
      ["NOP", 0b000000, this.INST_TYPE_ZERO],
      ["ENI", 0b000001, this.INST_TYPE_ZERO],
      ["DSI", 0b000010, this.INST_TYPE_ZERO],
      ["STC", 0b000011, this.INST_TYPE_ZERO],
      ["CLC", 0b000100, this.INST_TYPE_ZERO],
      ["CMC", 0b000101, this.INST_TYPE_ZERO],
      ["RET", 0b000110, this.INST_TYPE_ZERO],
      ["RTI", 0b000111, this.INST_TYPE_ZERO],
      ["INT", 0b001000, this.INST_TYPE_ZERO_CONST],
      ["RETN", 0b001001, this.INST_TYPE_ZERO_CONST],
      ["NEG", 0b010000, this.INST_TYPE_ONE],
      ["INC", 0b010001, this.INST_TYPE_ONE],
      ["DEC", 0b010010, this.INST_TYPE_ONE],
      ["COM", 0b010011, this.INST_TYPE_ONE],
      ["PUSH", 0b010100, this.INST_TYPE_ONE],
      ["POP", 0b010101, this.INST_TYPE_ONE],
      ["SHR", 0b011000, this.INST_TYPE_ONE_CONST],
      ["SHL", 0b011001, this.INST_TYPE_ONE_CONST],
      ["SHRA", 0b011010, this.INST_TYPE_ONE_CONST],
      ["SHLA", 0b011011, this.INST_TYPE_ONE_CONST],
      ["ROR", 0b011100, this.INST_TYPE_ONE_CONST],
      ["ROL", 0b011101, this.INST_TYPE_ONE_CONST],
      ["RORC", 0b011110, this.INST_TYPE_ONE_CONST],
      ["ROLC", 0b011111, this.INST_TYPE_ONE_CONST],
      ["CMP", 0b100000, this.INST_TYPE_TWO],
      ["ADD", 0b100001, this.INST_TYPE_TWO],
      ["ADDC", 0b100010, this.INST_TYPE_TWO],
      ["SUB", 0b100011, this.INST_TYPE_TWO],
      ["SUBB", 0b100100, this.INST_TYPE_TWO],
      ["MUL", 0b100101, this.INST_TYPE_TWO],
      ["DIV", 0b100110, this.INST_TYPE_TWO],
      ["TEST", 0b100111, this.INST_TYPE_TWO],
      ["AND", 0b101000, this.INST_TYPE_TWO],
      ["OR", 0b101001, this.INST_TYPE_TWO],
      ["XOR", 0b101010, this.INST_TYPE_TWO],
      ["MOV", 0b101011, this.INST_TYPE_TWO],
      ["MVBH", 0b101100, this.INST_TYPE_TWO],
      ["MVBL", 0b101101, this.INST_TYPE_TWO],
      ["XCH", 0b101110, this.INST_TYPE_TWO],
      ["JMP", 0b110000, this.INST_TYPE_JUMP],
      ["CALL", 0b110010, this.INST_TYPE_JUMP],
      ["JMP.", 0b110001, this.INST_TYPE_JUMP_COND],
      ["CALL.", 0b110011, this.INST_TYPE_JUMP_COND],
      ["BR", 0b111000, this.INST_TYPE_JUMP_REL],
      ["BR.", 0b111001, this.INST_TYPE_JUMP_REL_COND],
    ].forEach((props) => this.registerInstruction(...props));
  }

  clearInstructions() {
    Object.keys(this.instructions).forEach((name) => {
      delete this.instructions[name];
    });
  }

  dumpInstructionsList() {
    let instNameMap = {};
    let staticMembers = {
      INST_TYPE_ZERO: this.INST_TYPE_ZERO,
      INST_TYPE_ZERO_CONST: this.INST_TYPE_ZERO_CONST,
      INST_TYPE_ONE: this.INST_TYPE_ONE,
      INST_TYPE_ONE_CONST: this.INST_TYPE_ONE_CONST,
      INST_TYPE_TWO: this.INST_TYPE_TWO,
      INST_TYPE_JUMP: this.INST_TYPE_JUMP,
      INST_TYPE_JUMP_COND: this.INST_TYPE_JUMP_COND,
      INST_TYPE_JUMP_REL: this.INST_TYPE_JUMP_REL,
      INST_TYPE_JUMP_REL_COND: this.INST_TYPE_JUMP_REL_COND,
    };
    Object.keys(staticMembers).forEach((prop) => {
      instNameMap[staticMembers[prop]] = prop.substr(10);
    });
    let text = [];
    let longestName = 0;
    Object.keys(this.instructions).forEach((name) => {
      if (name.length > longestName) {
        longestName = name.length;
      }
    });
    Object.keys(this.instructions).forEach((name) => {
      let { opcode, type } = this.instructions[name];
      let padded = name + " ".repeat(longestName - name.length);
      opcode = opcode.toString(2);
      opcode = "0".repeat(6 - opcode.length) + opcode;
      type = instNameMap[type];
      text.push(`${padded} ${opcode} ${type}`);
    });
    return text.join("\n");
  }

  registerInstructionList(text) {
    let newInstructions = {};
    let regex = /^([A-Z]+\.?)\s+([01]{6})\s+([A-Z_]+)(?:\s*#|$)/;
    let lines = text.split("\n");
    for (let i = 0, l = lines.length; i < l; i++) {
      let line = lines[i].trim();
      if (line.length === 0 || line[0] === "#") continue;
      let matches = line.match(regex);
      if (matches) {
        let type = "INST_TYPE_" + matches[3];
        const typeMap = {
          INST_TYPE_ZERO: this.INST_TYPE_ZERO,
          INST_TYPE_ZERO_CONST: this.INST_TYPE_ZERO_CONST,
          INST_TYPE_ONE: this.INST_TYPE_ONE,
          INST_TYPE_ONE_CONST: this.INST_TYPE_ONE_CONST,
          INST_TYPE_TWO: this.INST_TYPE_TWO,
          INST_TYPE_JUMP: this.INST_TYPE_JUMP,
          INST_TYPE_JUMP_COND: this.INST_TYPE_JUMP_COND,
          INST_TYPE_JUMP_REL: this.INST_TYPE_JUMP_REL,
          INST_TYPE_JUMP_REL_COND: this.INST_TYPE_JUMP_REL_COND,
        };
        if (typeMap[type] !== undefined) {
          if (newInstructions[matches[1]] === undefined) {
            newInstructions[matches[1]] = {
              name: matches[1],
              opcode: parseInt(matches[2], 2),
              type: typeMap[type],
            };
          } else {
            throw new Error(
              "Duplicate instruction '" + matches[1] + "', on line " + (i + 1),
            );
          }
        } else {
          throw new Error("Invalid type '" + type + "', on line " + (i + 1));
        }
      } else {
        throw new Error("Syntax error, on line " + (i + 1));
      }
    }
    this.clearInstructions();
    Object.assign(this.instructions, newInstructions);
  }
}
