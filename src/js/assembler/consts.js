export const MEMORY_SIZE = 65536;
export const MEMORY_WORD_SIZE = 2;

export const REGISTER_0 = 0;
export const REGISTER_SP = 14;
export const REGISTER_PC = 15;
export const OPRD_TYPE_STRING = -1; // 'Test String'
export const OPRD_TYPE_REGISTER = 0; // Rx
export const OPRD_TYPE_REGISTER_INDIRECT = 1; // M[Rx]
export const OPRD_TYPE_IMMEDIATE = 2; // W
export const OPRD_TYPE_DIRECT = 3; // M[W]
export const OPRD_TYPE_INDEXED = 4; // M[Rx+W]
export const OPRD_TYPE_RELATIVE = 5; // M[PC+W]
export const OPRD_TYPE_BASED = 6; // M[SP+W]
export const OPRD_TYPE_PC = 7; // PC
export const OPRD_TYPE_SP = 8; // SP
