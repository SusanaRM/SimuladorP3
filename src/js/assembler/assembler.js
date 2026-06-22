import { AssemblerError } from "./assembler-error.js";
import { AssemblerResult } from "./assembler-result.js";
import {
  OPRD_TYPE_BASED,
  OPRD_TYPE_DIRECT,
  OPRD_TYPE_IMMEDIATE,
  OPRD_TYPE_INDEXED,
  OPRD_TYPE_PC,
  OPRD_TYPE_REGISTER,
  OPRD_TYPE_REGISTER_INDIRECT,
  OPRD_TYPE_RELATIVE,
  OPRD_TYPE_SP,
  OPRD_TYPE_STRING,
  REGISTER_0,
} from "./consts.js";
import { ISA } from "./isa.js";
import { InstructionEncoder } from "./instruction-encoder.js";
import { SyntaxParser } from "./syntax-parser.js";

export class Assembler {
  constructor() {
    // Modern property renaming
    this.instructionSet = ISA.instance;
  }

  // Backwards compatibility layer for legacy code looking for .isa
  get isa() {
    return this.instructionSet;
  }
  set isa(value) {
    this.instructionSet = value;
  }

  // Performs fundamental architectural constraints checking on parsed instructions
  validateInstruction(instruction, compileResult) {
    const opName = instruction.name;
    const instType = instruction.getType();

    if (instType === "1" || instType === "1c") {
      if (instruction.operands[0]?.type === OPRD_TYPE_IMMEDIATE) {
        if (instType === "1c" || ["NEG", "INC", "DEC", "COM", "POP"].includes(opName)) {
          throw new AssemblerError(`${opName} cannot handle immediate addressing values`, undefined, instruction, compileResult);
        }
      }
    } else if (instType === "2") {
      if (instruction.operands[1]?.type === OPRD_TYPE_IMMEDIATE && ["MUL", "DIV", "XCH"].includes(opName)) {
        throw new AssemblerError(`${opName} cannot handle immediate addressing values`, undefined, instruction, compileResult);
      }
    }
  }

  // Compatibility wrapper for legacy code calling .defaultValidator()
  defaultValidator(instruction) {
    this.validateInstruction(instruction, null);
  }

  // Core generation architecture executing two passes over the structural components.
  compile(instructionList, externalValidator) {
    const compileResult = new AssemblerResult();
    const encoder = new InstructionEncoder(compileResult);
    const discoveredLabels = compileResult.labels;

    const fetchAddressingMode = (operand, currentInst) => {
      switch (operand.type) {
        case OPRD_TYPE_REGISTER:
        case OPRD_TYPE_SP:
        case OPRD_TYPE_PC:
          return 0;
        case OPRD_TYPE_REGISTER_INDIRECT:
          return 1;
        case OPRD_TYPE_IMMEDIATE:
          return 2;
        case OPRD_TYPE_DIRECT:
        case OPRD_TYPE_INDEXED:
        case OPRD_TYPE_RELATIVE:
        case OPRD_TYPE_BASED:
          return 3;
        default:
          throw new AssemblerError(`Invalid addressing target for ${currentInst.name}`, undefined, currentInst, compileResult);
      }
    };

    const hasImmediateOrAddress = (operand, currentInst) => {
      return fetchAddressingMode(operand, currentInst) >= 2;
    };

    const resolveImmediateValue = (operand, currentInst) => {
      if (!hasImmediateOrAddress(operand, currentInst)) {
        return 0;
      }
      if (typeof operand.w === "string") {
        if (discoveredLabels[operand.w] === undefined) {
          throw new AssemblerError(`Undefined label path: ${operand.w}`, undefined, currentInst, compileResult);
        }
        return operand.s === "-" ? -discoveredLabels[operand.w] : discoveredLabels[operand.w];
      }
      return operand.w;
    };

    const fetchRegisterIndex = (operand) => {
      if (operand.type === OPRD_TYPE_IMMEDIATE || operand.type === OPRD_TYPE_DIRECT) {
        return REGISTER_0;
      }
      return operand.r;
    };

    const bindLabelToOffset = (labelName, offsetValue) => {
      if (discoveredLabels[labelName] !== undefined) {
        throw new AssemblerError(`Duplicate label collision: ${labelName}`);
      }
      discoveredLabels[labelName] = offsetValue;
      compileResult.labelCount++;
    };

    // First Pass: Establish absolute program positioning and mapping out labels
    for (const currentInst of instructionList) {
      if (!currentInst.isPseudoInstruction() && !currentInst.isInstruction()) {
        throw new Error("Internal Error: unknown instruction structure");
      }

      const expectedOperands = currentInst.getNumOperands();
      if (expectedOperands === null && currentInst.operands.length < 1) {
        throw new AssemblerError(`${currentInst.name} requires at least 1 operand parameter`, undefined, currentInst, compileResult);
      } else if (expectedOperands !== null && expectedOperands !== currentInst.operands.length) {
        throw new AssemblerError(`${currentInst.name} requires precisely ${expectedOperands} operand(s)`, undefined, currentInst, compileResult);
      }

      const [firstOp, secondOp] = currentInst.operands;

      // Validate constraints regarding pseudocodes
      if (["ORIG", "EQU", "WORD", "TAB"].includes(currentInst.name) && firstOp?.type !== OPRD_TYPE_IMMEDIATE) {
        throw new AssemblerError(`Invalid addressing configuration for pseudo code ${currentInst.name}`, undefined, currentInst, compileResult);
      }

      if (["ORIG", "EQU"].includes(currentInst.name) && typeof firstOp?.w === "string") {
        throw new AssemblerError(`Pseudo code operation ${currentInst.name} cannot evaluate labels`, undefined, currentInst, compileResult);
      }

      switch (currentInst.name) {
        case "ORIG":
          encoder.setCursor(firstOp.w);
          continue;
        case "EQU":
          bindLabelToOffset(currentInst.label, firstOp.w);
          continue;
        case "WORD":
          bindLabelToOffset(currentInst.label, encoder.getCursor());
          encoder.advanceBy(1);
          continue;
        case "STR":
          bindLabelToOffset(currentInst.label, encoder.getCursor());
          for (const op of currentInst.operands) {
            if (op.type === OPRD_TYPE_STRING) {
              encoder.advanceBy(op.w.length);
            } else if (op.type === OPRD_TYPE_IMMEDIATE) {
              encoder.advanceBy(1);
            } else {
              throw new AssemblerError("Malformed argument structure for STR definition", undefined, currentInst, compileResult);
            }
          }
          continue;
        case "TAB":
          bindLabelToOffset(currentInst.label, encoder.getCursor());
          encoder.advanceBy(firstOp.w);
          continue;
      }

      if (currentInst.label) {
        bindLabelToOffset(currentInst.label, encoder.getCursor());
      }

      // Track relative pipeline advancements across base instructions
      const typeStr = currentInst.getType();
      switch (typeStr) {
        case this.instructionSet.INST_TYPE_ZERO:
        case this.instructionSet.INST_TYPE_ZERO_CONST:
        case this.instructionSet.INST_TYPE_JUMP_REL:
        case this.instructionSet.INST_TYPE_JUMP_REL_COND:
          encoder.advanceBy(1);
          break;
        case this.instructionSet.INST_TYPE_ONE:
        case this.instructionSet.INST_TYPE_ONE_CONST:
        case this.instructionSet.INST_TYPE_JUMP:
        case this.instructionSet.INST_TYPE_JUMP_COND:
          encoder.advanceBy(hasImmediateOrAddress(firstOp, currentInst) ? 2 : 1);
          break;
        case this.instructionSet.INST_TYPE_TWO:
          encoder.advanceBy(hasImmediateOrAddress(firstOp, currentInst) || hasImmediateOrAddress(secondOp, currentInst) ? 2 : 1);
          break;
      }
    }

    encoder.setCursor(0);

    // Second Pass: Generating raw bin sequences and emitting instructions
    for (const currentInst of instructionList) {
      compileResult.pseudoCount++;
      const [firstOp, secondOp] = currentInst.operands;

      switch (currentInst.name) {
        case "ORIG":
          encoder.setCursor(firstOp.w);
          continue;
        case "EQU":
          continue;
        case "WORD":
          encoder.storeValue(resolveImmediateValue(firstOp, currentInst), 2);
          continue;
        case "STR":
          for (const op of currentInst.operands) {
            if (op.type === OPRD_TYPE_STRING) {
              for (let charIdx = 0; charIdx < op.w.length; charIdx++) {
                encoder.storeValue(op.w.charCodeAt(charIdx), 3);
              }
            } else if (op.type === OPRD_TYPE_IMMEDIATE) {
              encoder.storeValue(resolveImmediateValue(op, currentInst), 3);
            } else {
              throw new AssemblerError("Malformed argument structure for STR execution", undefined, currentInst, compileResult);
            }
          }
          continue;
        case "TAB":
          const spacesCount = resolveImmediateValue(firstOp, currentInst);
          for (let spaceIdx = 0; spaceIdx < spacesCount; spaceIdx++) {
            encoder.storeValue(0, 4);
          }
          continue;
      }
      compileResult.pseudoCount--; // Correct offset evaluation tracking for operations

      if (currentInst.label && discoveredLabels[currentInst.label] !== encoder.getCursor()) {
        throw new Error("Internal Compilation Error: Segment mismatch on code alignment tracking");
      }

      compileResult.instructionCount++;
      const instType = currentInst.getType();

      switch (instType) {
        case this.instructionSet.INST_TYPE_ZERO:
          encoder.emitOpZero(currentInst.getOpcode());
          break;
        case this.instructionSet.INST_TYPE_ZERO_CONST: {
          if (firstOp.type !== OPRD_TYPE_IMMEDIATE) {
            throw new AssemblerError("Argument context must resolve directly to immediate", undefined, currentInst, compileResult);
          }
          const constVal = resolveImmediateValue(firstOp, currentInst);
          if (constVal < 0 || constVal > 1023) {
            throw new AssemblerError("Immediate bounds bounds conflict: Must scale 0 to 1023", undefined, currentInst, compileResult);
          }
          encoder.emitOpConst(currentInst.getOpcode(), constVal);
          break;
        }
        case this.instructionSet.INST_TYPE_ONE:
        case this.instructionSet.INST_TYPE_JUMP: {
          const mode = fetchAddressingMode(firstOp, currentInst);
          const reg = fetchRegisterIndex(firstOp);
          const payload = resolveImmediateValue(firstOp, currentInst);
          encoder.emitOpOne(currentInst.getOpcode(), mode, reg, payload);
          break;
        }
        case this.instructionSet.INST_TYPE_ONE_CONST: {
          const mode = fetchAddressingMode(firstOp, currentInst);
          if (secondOp.type !== OPRD_TYPE_IMMEDIATE) {
            throw new AssemblerError("Terminal operand constraint error: Requires static numeric literal", undefined, currentInst, compileResult);
          }
          const smallConst = resolveImmediateValue(secondOp, currentInst);
          if (smallConst < 0 || smallConst > 15) {
            throw new AssemblerError("Immediate inline bounds error: Must scale 0 to 15", undefined, currentInst, compileResult);
          }
          const reg = fetchRegisterIndex(firstOp);
          const payload = resolveImmediateValue(firstOp, currentInst);
          encoder.emitOpOneC(currentInst.getOpcode(), smallConst, mode, reg, payload);
          break;
        }
        case this.instructionSet.INST_TYPE_TWO: {
          if (firstOp.type === OPRD_TYPE_IMMEDIATE) {
            throw new AssemblerError("Source tracking conflict: Initial operand parameter cannot be immediate", undefined, currentInst, compileResult);
          }
          let directionFlag, coreReg, targetOperand;
          if (firstOp.type === OPRD_TYPE_REGISTER) {
            directionFlag = 1;
            coreReg = firstOp.r;
            targetOperand = secondOp;
          } else if (secondOp.type === OPRD_TYPE_REGISTER) {
            directionFlag = 0;
            coreReg = secondOp.r;
            targetOperand = firstOp;
          } else {
            throw new AssemblerError("Structural evaluation failure: At least one parameter must resolve to physical register", undefined, currentInst, compileResult);
          }
          const mode = fetchAddressingMode(targetOperand, currentInst);
          const reg = fetchRegisterIndex(targetOperand);
          const payload = resolveImmediateValue(targetOperand, currentInst);
          encoder.emitOpTwo(currentInst.getOpcode(), directionFlag, coreReg, mode, reg, payload);
          break;
        }
        case this.instructionSet.INST_TYPE_JUMP_COND: {
          const mode = fetchAddressingMode(firstOp, currentInst);
          const condCode = currentInst.getConditionCode();
          const reg = fetchRegisterIndex(firstOp);
          const payload = resolveImmediateValue(firstOp, currentInst);
          encoder.emitOpOneC(currentInst.getOpcode(), condCode, mode, reg, payload);
          break;
        }
        case this.instructionSet.INST_TYPE_JUMP_REL:
        case this.instructionSet.INST_TYPE_JUMP_REL_COND: {
          if (firstOp.type !== OPRD_TYPE_IMMEDIATE) {
            throw new AssemblerError(`Instruction evaluation conflict under context ${currentInst.name}`, undefined, currentInst, compileResult);
          }
          const relativeOffset = resolveImmediateValue(firstOp, currentInst) - encoder.getCursor() - 1;
          if (relativeOffset < -32 || relativeOffset > 31) {
            throw new AssemblerError("Target offset out of scope for relative branch jumping execution", undefined, currentInst, compileResult);
          }
          if (instType === "jr") {
            encoder.emitJumpRel(currentInst.getOpcode(), relativeOffset);
          } else {
            const condCode = currentInst.getConditionCode();
            encoder.emitJumpCondRel(currentInst.getOpcode(), condCode, relativeOffset);
          }
          break;
          }
        default:
          throw new Error("Internal Evaluation Error: Unrecognized runtime structural configuration matching.");
      }

      if (externalValidator) {
        externalValidator(currentInst);
      }
    }
    return compileResult;
  }

  // Compatibility wrapper for legacy code calling .assembleData()
  assembleData(data, validator) {
    return this.compile(data, validator);
  }

  // Translates incoming code logic strings utilizing custom parameter inputs.
  parseAndCompile(textInput, customParser = new SyntaxParser()) {
    const rawAST = customParser.parseString(textInput);
    return this.compile(rawAST, (inst) => this.validateInstruction(inst, null));
  }

  // Compatibility wrapper for legacy code calling .assembleWithDefaultValidator()
  assembleWithDefaultValidator(text, parser) {
    return this.parseAndCompile(text, parser);
  }

  //Main forward-compatible entry validation endpoint
  assemble(text) {
    return this.parseAndCompile(text);
  }
}