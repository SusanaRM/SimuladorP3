import { AssemblerError } from "./assembler-error.js";
import {
  OPRD_TYPE_BASED,
  OPRD_TYPE_DIRECT,
  OPRD_TYPE_IMMEDIATE,
  OPRD_TYPE_INDEXED,
  OPRD_TYPE_REGISTER,
  OPRD_TYPE_REGISTER_INDIRECT,
  OPRD_TYPE_RELATIVE,
  OPRD_TYPE_SP,
  OPRD_TYPE_STRING,
  REGISTER_PC,
  REGISTER_SP,
} from "./consts.js";
import { Instruction } from "./instruction.js";
import { ISA } from "./isa.js";

export class SyntaxParser {
  constructor() {
    // Stylistically updated core property
    this.instructionSetArchitecture = ISA.instance;
  }

  // Backwards compatibility layer for legacy code expecting .isa
  get isa() {
    return this.instructionSetArchitecture;
  }
  set isa(value) {
    this.instructionSetArchitecture = value;
  }

  /**
   * Evaluates text strings and converts valid numeric definitions into structural integer components.
   */
  evaluateNumericLiteral(literalText) {
    let computedVal = null;
    
    const encodingSpecs = [
      { pattern: /^[-+]?([01]{1,16})b$/i, radix: 2 },   // Binary notation
      { pattern: /^[-+]?([0-7]{1,6})o$/i, radix: 8 },   // Octal notation
      { pattern: /^[-+]?([0-9]{1,5})d?$/i, radix: 10 }, // Decimal notation
      { pattern: /^[-+]?([0-9a-f]{1,4})h$/i, radix: 16 } // Hexadecimal notation
    ];

    for (const spec of encodingSpecs) {
      const patternMatch = literalText.match(spec.pattern);
      if (patternMatch) {
        computedVal = parseInt(patternMatch[1], spec.radix);
        if (patternMatch[0].startsWith("-")) {
          computedVal = -computedVal;
        }
        break;
      }
    }

    // Attempt alternative single-character ASCII translation if numeric parsing yields nothing
    if (computedVal === null && literalText.length === 3 && literalText.startsWith("'") && literalText.endsWith("'")) {
      computedVal = literalText.charCodeAt(1);
    }

    if (computedVal === null || computedVal < -32768 || computedVal > 65535) {
      return null;
    }

    return computedVal & 0xffff;
  }

  // Legacy fallback proxy
  parseConstant(text) {
    return this.evaluateNumericLiteral(text);
  }

  /**
   * Safely isolates literal text encapsulated inside string syntax.
   */
  extractStringLiteral(rawToken) {
    const totalLength = rawToken.length;
    if (totalLength > 3 && rawToken.startsWith("'") && rawToken.endsWith("'")) {
      const innerContent = rawToken.slice(1, -1);
      if (innerContent.includes("'")) {
        return null;
      }
      return innerContent;
    }
    return null;
  }

  // Legacy fallback proxy
  parseStringConstant(text) {
    return this.extractStringLiteral(text);
  }

  /**
   * Assesses label inputs against structural identifier requirements.
   */
  isCompliantLabelIdentifier(identifier) {
    return /^[a-z_]\w*$/i.test(identifier);
  }

  // Legacy fallback proxy
  isValidLabel(value) {
    return this.isCompliantLabelIdentifier(value);
  }

  /**
   * Direct pipeline processing token content into either static constants or functional addresses.
   */
  resolveLiteralOrIdentifier(tokenValue, algebraicSign, lineIndex) {
    let computedValue = this.evaluateNumericLiteral(`${algebraicSign}${tokenValue}`);
    if (computedValue === null && this.isCompliantLabelIdentifier(tokenValue)) {
      computedValue = tokenValue;
    }
    if (computedValue === null) {
      throw new AssemblerError("Syntax error, invalid operand constant", lineIndex);
    }
    return computedValue;
  }

  // Legacy fallback proxy
  processConstantOrLabel(value, sign, n) {
    return this.resolveLiteralOrIdentifier(value, sign, n);
  }

  /**
   * Breaks down operand token components into their corresponding behavioral objects.
   */
  decodeOperandToken(rawOperand, lineIndex) {
    const operandToken = rawOperand.trim();
    if (!operandToken) {
      throw new AssemblerError("Syntax error, invalid operand (empty?)", lineIndex);
    }

    let captureGroups;
    if ((captureGroups = operandToken.match(/^R([0-7])$/i))) {
      return { type: OPRD_TYPE_REGISTER, r: captureGroups[1].charCodeAt(0) - 48 };
    }
    
    if (operandToken.toUpperCase() === "SP") {
      return { type: OPRD_TYPE_SP, r: REGISTER_SP };
    }
    
    // Evaluate memory bracket layout formatting expressions: M[...]
    if ((captureGroups = operandToken.match(/^M\s*\[\s*(?:(SP|PC|R[0-7])(?:\s*(\+|-)\s*([^\s].*?))?|([^\s].*?))\s*\]$/i))) {
      if (captureGroups[4]) {
        const staticAddress = this.resolveLiteralOrIdentifier(captureGroups[4], "", lineIndex);
        return { type: OPRD_TYPE_DIRECT, w: staticAddress };
      }
      
      if (captureGroups[1]) {
        const baseMemoryOperand = { type: OPRD_TYPE_INDEXED, w: 0 };
        const referenceRegister = captureGroups[1].toUpperCase();
        
        if (referenceRegister === "SP") {
          baseMemoryOperand.type = OPRD_TYPE_BASED;
          baseMemoryOperand.r = REGISTER_SP;
        } else if (referenceRegister === "PC") {
          baseMemoryOperand.type = OPRD_TYPE_RELATIVE;
          baseMemoryOperand.r = REGISTER_PC;
        } else {
          baseMemoryOperand.r = captureGroups[1].charCodeAt(1) - 48;
        }
        
        if (captureGroups[2]) {
          baseMemoryOperand.s = captureGroups[2];
          baseMemoryOperand.w = this.resolveLiteralOrIdentifier(captureGroups[3], captureGroups[2], lineIndex);
        } else if (baseMemoryOperand.r !== REGISTER_SP) {
          return { type: OPRD_TYPE_REGISTER_INDIRECT, r: baseMemoryOperand.r };
        }
        return baseMemoryOperand;
      }
    } else {
      const detectedString = this.extractStringLiteral(operandToken);
      if (detectedString !== null) {
        return { type: OPRD_TYPE_STRING, w: detectedString };
      }
      const processedImmediate = this.resolveLiteralOrIdentifier(operandToken, "", lineIndex);
      return { type: OPRD_TYPE_IMMEDIATE, w: processedImmediate };
    }
    return null;
  }

  // Legacy fallback proxy
  processOperand(operand, n) {
    return this.decodeOperandToken(operand, n);
  }

  /**
   * Decodes an individual raw string statement line directly into structural Instruction frameworks.
   */
  transpileSourceLine(rawLineText, lineIndex) {
    const syntaxMatches = rawLineText.match(/^\s*(?:([a-z_]\w*)(?:\s+|\s*(:)\s*))?([a-z]+)(?:\s*\.\s*([a-z]+))?(?:\s+(.*?)\s*)?$/i);
    // Captured maps: 1 -> Label definition, 2 -> Colon marker, 3 -> Core Operation, 4 -> Conditional criteria, 5 -> Operands sequence string
    if (!syntaxMatches) {
      throw new AssemblerError("Syntax error", lineIndex);
    } else if (!syntaxMatches[3]) {
      throw new Error("Internal Error: invalid regex result");
    }

    const generatedInstruction = new Instruction(true);
    generatedInstruction.debug.text = rawLineText;
    generatedInstruction.debug.line = lineIndex;

    let labelGroup = syntaxMatches[1];
    let colonGroup = syntaxMatches[2];
    let mnemonicGroup = syntaxMatches[3];
    let conditionGroup = syntaxMatches[4];
    let operandsGroup = syntaxMatches[5];

    if (labelGroup) {
      const labelUpper = labelGroup.toUpperCase();
      if (this.instructionSetArchitecture.pseudoInstructions[labelUpper] || this.instructionSetArchitecture.instructions[labelUpper]) {
        if (colonGroup || conditionGroup || operandsGroup) {
          throw new AssemblerError("Syntax error, invalid label", lineIndex);
        } else {
          operandsGroup = mnemonicGroup;
          mnemonicGroup = labelGroup;
          labelGroup = undefined;
        }
      } else {
        generatedInstruction.label = labelGroup;
      }
    }

    generatedInstruction.name = mnemonicGroup.toUpperCase() + (conditionGroup ? "." : "");
    
    if (generatedInstruction.isInstruction()) {
      if (generatedInstruction.label && !colonGroup) {
        throw new AssemblerError("Syntax error, invalid label (missing colon?)", lineIndex);
      } else if (conditionGroup) {
        generatedInstruction.condition = conditionGroup.toUpperCase();
        if (generatedInstruction.getConditionCode() === null) {
          throw new AssemblerError("Syntax error, invalid condition", lineIndex);
        }
      }
    } else if (generatedInstruction.isPseudoInstruction()) {
      if (generatedInstruction.requiresLabel()) {
        if (!generatedInstruction.label || colonGroup) {
          throw new AssemblerError("Syntax error, invalid or missing label", lineIndex);
        }
      } else if (generatedInstruction.label) {
        throw new AssemblerError(`Syntax error, '${generatedInstruction.name}' cannot have a label`, lineIndex);
      }
    } else {
      throw new AssemblerError("Syntax error, invalid instruction", lineIndex);
    }

    if (operandsGroup) {
      let isInsideStringLiteral = false;
      let trackingBuffer = "";
      
      for (const charItem of operandsGroup) {
        if (charItem === "," && !isInsideStringLiteral) {
          generatedInstruction.operands.push(this.decodeOperandToken(trackingBuffer, lineIndex));
          trackingBuffer = "";
        } else {
          if (charItem === "'") {
            isInsideStringLiteral = !isInsideStringLiteral;
          }
          trackingBuffer += charItem;
        }
      }
      generatedInstruction.operands.push(this.decodeOperandToken(trackingBuffer, lineIndex));
    }
    
    return generatedInstruction;
  }

  // Legacy fallback proxy
  processLine(text, n) {
    return this.transpileSourceLine(text, n);
  }

  /**
   * Iterates through full file contents to output structured compilation arrays while scrubbing out comment elements.
   */
  tokenizeSourceText(rawCodeText) {
    const compilationUnits = [];
    let structuralLineIndex = 1;
    let activeCommentState = false;
    let activeStringState = false;
    let lineCompositionBuffer = "";

    for (const individualChar of rawCodeText) {
      if (individualChar === "\n") {
        if (lineCompositionBuffer && lineCompositionBuffer.trim()) {
          compilationUnits.push(this.transpileSourceLine(lineCompositionBuffer, structuralLineIndex));
        }
        lineCompositionBuffer = "";
        structuralLineIndex++;
        activeCommentState = false;
        activeStringState = false;
      } else if (activeCommentState) {
        // Suppress appending characters while inside comment scopes
      } else if (individualChar === ";" && !activeStringState) {
        activeCommentState = true;
      } else {
        if (individualChar === "'") {
          activeStringState = !activeStringState;
        }
        lineCompositionBuffer += individualChar;
      }
    }

    if (lineCompositionBuffer && lineCompositionBuffer.trim()) {
      compilationUnits.push(this.transpileSourceLine(lineCompositionBuffer, structuralLineIndex));
    }
    
    return compilationUnits;
  }

  // Legacy fallback proxy matching standard external calls
  parseString(text) {
    return this.tokenizeSourceText(text);
  }
}