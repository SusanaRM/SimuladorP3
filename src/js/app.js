// Main application initialization
import { CPU } from './cpu-core/cpu.js';
import { Assembler } from './assembler/assembler.js';
import { Disassembler } from './assembler/disassembler.js';
import { memory } from './memory-system/memory.js';

// Global instances
let cpu;
let assembler;
let disassembler;
let programLength = 0;
let runIntervalId = null;
let isRunning = false;
let statusDisplay = null;
let programStatusDisplay = null;
const breakpoints = new Set();
let resumeBreakpointOnce = false;

let activeMemoryViewers = []; // Track active memory viewers for updates
const previousRegisterValues = new Map();
const previousFlagValues = new Map();
const HIGHLIGHT_DURATION_MS = 2000;

function initApp() {
    // Initialize CPU, Assembler, and Disassembler
    cpu = new CPU(memory);
    assembler = new Assembler();
    disassembler = new Disassembler();

    // Update displays initially
    updateRegisterDisplay();
    updateMemoryDisplay();
    updateProgramView();
    setClockDisplay();
    updateExecutionCounters();

    // Set up event listeners
    setupEventListeners();
}

function updateRegisterDisplay() {
    const registers = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', /*'R8', 'R9', 'R10', 'R11', 'R12', 'R13', */'PC', 'SP'];
    const format = document.getElementById('register-format').value;

    registers.forEach((regName) => {
        const element = document.getElementById(`reg-${regName}`);
        if (element) {
            const value = cpu.registers[regName];
            const previousValue = previousRegisterValues.get(regName);
            const displayValue = formatRegisterValue(value, format);

            element.textContent = displayValue;
            if (previousValue !== undefined && previousValue !== value) {
                highlightChange(element);
            }
            previousRegisterValues.set(regName, value);
        }
    });

    const flags = cpu.flags;
    ['Z', 'C', 'N', 'O', 'E', 'z', 'c'].forEach((flagName) => {
        const element = document.getElementById(`flag-${flagName}`);
        if (!element) return;
        const value = flags[flagName] ? 1 : 0;
        const previousValue = previousFlagValues.get(flagName);
        element.textContent = `${flagName}=${value}`;
        if (previousValue !== undefined && previousValue !== value) {
            highlightChange(element);
        }
        previousFlagValues.set(flagName, value);
    });
}

function updateProgramView({ highlightCurrent = true, scrollToCurrent = true } = {}) {
    const viewer = document.getElementById('program-viewer-content');
    if (!viewer) return;

    viewer.innerHTML = '';

    if (programLength === 0) {
        const row = document.createElement('div');
        row.className = 'instruction-row';
        row.innerHTML = '<div class="instruction-code">No program loaded.</div>';
        viewer.appendChild(row);
        return;
    }

    const codeWords = Array.from(memory.slice(0, programLength));
    const instructions = disassembler.disassemble(codeWords);
    const currentPC = cpu.registers.PC;

    let currentInstructionRow;

    instructions.forEach((instruction) => {
        if (instruction.inst == '') return;
        const row = document.createElement('div');
        row.className = 'instruction-row';
        row.dataset.addr = instruction.addr;
        if (breakpoints.has(instruction.addr)) {
            row.classList.add('breakpoint-active');
        }
        if (highlightCurrent && instruction.addr <= currentPC) {
            currentInstructionRow = row;
        }

        const breakpointMarker = breakpoints.has(instruction.addr) ? '●' : '○';
        row.innerHTML = `
            <div class="breakpoint-indicator" title="Click to toggle breakpoint">${breakpointMarker}</div>
            <div class="instruction-addr">0x${instruction.addr.toString(16).toUpperCase().padStart(4, '0')}</div>
            <div class="instruction-code">${instruction.inst}</div>
            <div class="instruction-bytes">${'0x' + (instruction.value.toString(16).toUpperCase().padStart(4, '0'))}</div>
        `;

        row.addEventListener('click', () => {
            toggleBreakpoint(instruction.addr);
            const marker = row.querySelector('.breakpoint-indicator');
            if (breakpoints.has(instruction.addr)) {
                row.classList.add('breakpoint-active');
                marker.textContent = '●';
                updateStatus(`Breakpoint set at 0x${instruction.addr.toString(16).toUpperCase().padStart(4, '0')}`, 'info');
            } else {
                row.classList.remove('breakpoint-active');
                marker.textContent = '○';
                updateStatus(`Breakpoint cleared at 0x${instruction.addr.toString(16).toUpperCase().padStart(4, '0')}`, 'info');
            }
        });

        viewer.appendChild(row);
    });

    currentInstructionRow?.classList.add('current-pc');

    const currentRow = viewer.querySelector('.instruction-row.current-pc');
    if (scrollToCurrent && currentRow) {
        currentRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function toggleBreakpoint(address) {
    if (breakpoints.has(address)) {
        breakpoints.delete(address);
    } else {
        breakpoints.add(address);
    }
}

function formatRegisterValue(value, format) {
    switch (format) {
        case 'decimal':
            // Handle signed 16-bit values
            const signed = value > 32767 ? value - 65536 : value;
            return signed.toString();
        case 'binary':
            return '0b' + value.toString(2).padStart(16, '0');
        case 'ascii':
            const highByte = (value >> 8) & 0xFF;
            const lowByte = value & 0xFF;
            const highChar = (highByte >= 32 && highByte <= 126) ? String.fromCharCode(highByte) : '.';
            const lowChar = (lowByte >= 32 && lowByte <= 126) ? String.fromCharCode(lowByte) : '.';
            return `'${highChar}${lowChar}' (${value})`;
        default:
            return '0x' + value.toString(16).toUpperCase().padStart(4, '0');
    }
}

function getClockSpeedHz() {
    // Exponential scaling: Hz = 2^((value-1)/3)
    // This gives: 1→1Hz, 10→8Hz, 20→80Hz, 30→800Hz, 40→8000Hz, 50→80000Hz
    const sliderValue = parseInt(document.getElementById('clock-speed').value, 10) || 5;
    const hz = Math.pow(2, (sliderValue - 1) / 3);
    return Math.round(hz);
}

function getClockDelay() {
    const hz = getClockSpeedHz();
    return Math.max(1, Math.round(1000 / hz));
}

function humanizeHz(hz) {
    if (hz === 0) return "0 Hz";

    // Define the units
    const units = ["Hz", "kHz", "MHz", "GHz", "THz"];

    // Calculate the magnitude (log10 helps determine the index)
    let i = Math.floor(Math.log10(hz) / 3);

    // Calculate the value and round to 2 decimal places
    let value = (hz / Math.pow(10, i * 3)).toFixed(2);
    if (hz < 1) {
        value = hz.toFixed(2);
        i = 0;
    }

    // Return formatted string, avoiding units out of range
    return `${value} ${units[i] || "Unknown"}`;
}

function setClockDisplay() {
    const hz = getClockSpeedHz();
    document.getElementById('clock-speed-display').textContent = `${humanizeHz(hz)}`;
}

function updateExecutionCounters() {
    const clockElement = document.getElementById('clock-cycle-count');
    const instructionElement = document.getElementById('instruction-count');
    if (clockElement) {
        clockElement.textContent = cpu?.cycleCounter?.toString() ?? '0';
    }
    if (instructionElement) {
        instructionElement.textContent = cpu?.executedInstructionCounter?.toString() ?? '0';
    }
}

function highlightChange(element) {
    element.classList.add('highlight-change');
    if (element._highlightTimeoutId) {
        clearTimeout(element._highlightTimeoutId);
    }

    if (!isRunning) {
        delete element._highlightTimeoutId;
        return;
    }

    element._highlightTimeoutId = setTimeout(() => {
        element.classList.remove('highlight-change');
        delete element._highlightTimeoutId;
    }, HIGHLIGHT_DURATION_MS);
}

function pauseHighlightTimeouts() {
    document.querySelectorAll('.highlight-change').forEach((element) => {
        if (element._highlightTimeoutId) {
            clearTimeout(element._highlightTimeoutId);
            delete element._highlightTimeoutId;
        }
    });
}

function clearAllHighlights() {
    document.querySelectorAll('.highlight-change').forEach((element) => {
        element.classList.remove('highlight-change');
        if (element._highlightTimeoutId) {
            clearTimeout(element._highlightTimeoutId);
            delete element._highlightTimeoutId;
        }
    });
    activeMemoryViewers.forEach((viewer) => {
        if (viewer.highlightExpiry) {
            viewer.highlightExpiry.clear();
        }
    });
}

function stopExecution() {
    if (runIntervalId !== null) {
        clearInterval(runIntervalId);
        runIntervalId = null;
    }
    isRunning = false;
    pauseHighlightTimeouts();
    const runBtn = document.getElementById('run-btn');
    if (runBtn) {
        runBtn.textContent = '▶ Run';
    }
}

let cycleCount = 0;
let lastTime = performance.now();
let actualHz = 0;

function updateStats(cyclesExecuted) {
    cycleCount += cyclesExecuted;
    const now = performance.now();
    const elapsed = now - lastTime;

    // Update the speed calculation text once every 100ms for a smooth UI
    if (elapsed >= 100) {
        actualHz = (cycleCount * 1000) / elapsed;
        cycleCount = 0;
        lastTime = now;

        const humanSpeed = humanizeHz(actualHz);
        updateStatus(`Running @ ${humanSpeed}. PC=0x${cpu.registers.PC.toString(16).toUpperCase().padStart(4, '0')}`, 'info');
    }

    // UPDATE UI ONCE PER INTERVAL TICK (Approx 50fps)
    updateProgramView();
    updateRegisterDisplay();
    updateMemoryDisplay();

    return actualHz;
}

function startExecution() {
    if (isRunning) return;
    stopExecution();
    const TICK_RATE_MS = 20;

    // Reset trackers
    cycleCount = 0;
    lastTime = performance.now();
    let cycleAccumulator = 0;
    const targetHz = getClockSpeedHz();

    clearAllHighlights();
    const runBtn = document.getElementById('run-btn');
    if (runBtn) runBtn.textContent = '⏹ Stop';

    isRunning = true;

    runIntervalId = setInterval(() => {
        const frameStart = performance.now();
        // 1. Calculate how many fractional cycles belong in this 20ms tick
        // e.g., At 5 Hz, cyclesPerTick = 5 * 0.02 = 0.1 cycles per tick
        const cyclesPerTick = targetHz * (TICK_RATE_MS / 1000);

        // 2. Accumulate the fractional value
        cycleAccumulator += cyclesPerTick;

        // 3. Extract the integer number of cycles ready to run right now
        // e.g., floor(0.1) = 0. On the 10th tick, floor(1.0) = 1.
        let cyclesToRun = Math.floor(cycleAccumulator);

        // 4. Keep the remainder fraction for the next tick
        cycleAccumulator -= cyclesToRun;

        try {
            const currentPC = cpu.registers.PC;
            
            // Se o emulador for iniciado exatamente em cima de um breakpoint, tratamos o bypass
            const shouldBypassBreakpoint = resumeBreakpointOnce;
            resumeBreakpointOnce = false;

            if (cyclesToRun > 0) {
                for (let i = 0; i < cyclesToRun; i++) {
                    
                    // Executa 1 ciclo de relógio e recolhe se a instrução Assembly terminou
                    const isInstructionFinished = cpu.executeSingleClockCycle();

                    // SÓ verificamos breakpoints quando a instrução Assembly terminar por completo
                    if (isInstructionFinished) {
                        const nextPC = cpu.registers.PC;
                        
                        if (breakpoints.has(nextPC)) {
                            if (shouldBypassBreakpoint && nextPC === currentPC) {
                                // Ignora o breakpoint se o utilizador acabou de carregar em "Continuar" no mesmo PC
                                continue;
                            }
                            
                            stopExecution();
                            updateStatus(`Breakpoint hit at 0x${nextPC.toString(16).toUpperCase().padStart(4, '0')}`, 'info');
                            break;
                        }
                    }

                    // Mecanismo de segurança contra sobrecarga
                    if (performance.now() - frameStart >= TICK_RATE_MS * 4 / 5) {
                        console.debug(`Could not keep up! Processed only ${i + 1} of ${cyclesToRun} cycles.`);
                        cyclesToRun = i + 1;
                        break;
                    }
                }
            }

            // Passa os ciclos executados para atualizar a interface
            updateStats(cyclesToRun);
            updateExecutionCounters();

        } catch (error) {
            stopExecution();
            updateStatus(`Execution halted: ${error.message}`, 'error');
        }
    }, TICK_RATE_MS);
}

function updateStatus(message, className) {
    if (statusDisplay && programStatusDisplay) {
        statusDisplay.textContent = message;
        statusDisplay.className = `status ${className}`;
        programStatusDisplay.textContent = message;
        programStatusDisplay.className = `status ${className}`;
    }
}

function renderMemoryRange(container, startAddr, range, previousValues = new Map(), highlightExpiry = new Map()) {
    container.innerHTML = '';

    const wordsPerRow = 8;
    const totalRows = Math.ceil(range / wordsPerRow);
    const now = Date.now();

    for (let row = 0; row < totalRows; row++) {
        const addr = startAddr + (row * wordsPerRow);

        const rowDiv = document.createElement('div');
        rowDiv.className = 'memory-row';

        const addrDiv = document.createElement('div');
        addrDiv.className = 'memory-addr';
        addrDiv.textContent = addr.toString(16).toLowerCase().padStart(4, '0') + ' : ';
        rowDiv.appendChild(addrDiv);

        const hexDiv = document.createElement('div');
        hexDiv.className = 'memory-hex-col';
        const asciiDiv = document.createElement('div');
        asciiDiv.className = 'memory-ascii';

        for (let col = 0; col < wordsPerRow; col++) {
            const currentAddr = addr + col;
            if (currentAddr >= startAddr + range) break;

            const word = memory.read(currentAddr) || 0;
            const hexText = word.toString(16).toLowerCase().padStart(4, '0');
            const asciiText = (word >= 32 && word <= 126) ? String.fromCharCode(word) : '.';
            const previousWord = previousValues.get(currentAddr);
            const changed = previousWord !== undefined && previousWord !== word;
            const expiry = highlightExpiry.get(currentAddr);
            const keepHighlight = expiry === Infinity || (typeof expiry === 'number' && expiry > now);

            if (changed) {
                highlightExpiry.set(currentAddr, isRunning ? now + HIGHLIGHT_DURATION_MS : Infinity);
            }

            const hexCell = document.createElement('span');
            hexCell.className = 'memory-cell memory-cell-hex';
            hexCell.textContent = `${hexText} `;
            const asciiCell = document.createElement('span');
            asciiCell.className = 'memory-cell memory-cell-ascii';
            asciiCell.textContent = asciiText;

            if (changed || keepHighlight) {
                hexCell.classList.add('highlight-change');
                asciiCell.classList.add('highlight-change');
            }

            if (!changed && !keepHighlight && highlightExpiry.has(currentAddr)) {
                highlightExpiry.delete(currentAddr);
            }

            hexDiv.appendChild(hexCell);
            asciiDiv.appendChild(asciiCell);
            previousValues.set(currentAddr, word);
        }

        rowDiv.appendChild(hexDiv);
        const spacer = document.createTextNode('  ');
        rowDiv.appendChild(spacer);
        rowDiv.appendChild(asciiDiv);
        container.appendChild(rowDiv);
    }
}

function resetCpuState() {
    stopExecution();
    cpu.reset();
    previousRegisterValues.clear();
}

function updateMemoryDisplay() {
    activeMemoryViewers.forEach(({ viewerCard, render }) => {
        render();
    });
}

function createMemorySnapshotViewer(startAddr, range, allowRemove = true) {
    const collection = document.getElementById('memory-viewer-collection');
    if (!collection) return;

    const viewerCard = document.createElement('div');
    viewerCard.className = 'memory-static-viewer';

    const header = document.createElement('div');
    header.className = 'memory-static-viewer-header';

    const label = document.createElement('div');
    header.appendChild(label);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.style.visibility = allowRemove ? 'visible' : 'hidden';
    header.appendChild(removeBtn);

    viewerCard.appendChild(header);

    const controls = document.createElement('div');
    controls.className = 'memory-static-viewer-controls';

    const offsetLabel = document.createElement('label');
    offsetLabel.className = 'memory-static-control-label';
    offsetLabel.textContent = 'Offset: ';
    const offsetInput = document.createElement('input');
    offsetInput.type = 'text';
    offsetInput.value = '0x' + startAddr.toString(16).toUpperCase().padStart(4, '0');
    offsetInput.size = 6;
    offsetLabel.appendChild(offsetInput);

    const rangeLabel = document.createElement('label');
    rangeLabel.className = 'memory-static-control-label';
    rangeLabel.textContent = 'Range: ';
    const rangeInput = document.createElement('select');
    ['256', '512', '1024'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value === '256' ? '256 words (0x100)' : value === '512' ? '512 words (0x200)' : '1KB (0x400)';
        if (parseInt(value, 10) === range) option.selected = true;
        rangeInput.appendChild(option);
    });
    rangeLabel.appendChild(rangeInput);

    const presetLabel = document.createElement('label');
    presetLabel.className = 'memory-static-control-label';
    presetLabel.textContent = 'View: ';
    const presetSelect = document.createElement('select');
    const presets = [
        { value: '0x0000', text: 'Program Memory (0x0000)' },
        { value: '0x8000', text: 'RAM (0x8000)' },
        { value: '0xFD00', text: 'Stack Area (0xFD00)' },
        { value: '0xFF00', text: 'I/O Devices (0xFF00)' },
        { value: 'custom', text: 'Custom Range' }
    ];
    presets.forEach((preset) => {
        const option = document.createElement('option');
        option.value = preset.value;
        option.textContent = preset.text;
        presetSelect.appendChild(option);
    });
    if (startAddr === 0x0000) {
        presetSelect.value = '0x0000';
    } else if (startAddr === 0x1000) {
        presetSelect.value = '0x1000';
    } else if (startAddr === 0xFF00) {
        presetSelect.value = '0xFF00';
    } else {
        presetSelect.value = 'custom';
    }
    presetLabel.appendChild(presetSelect);

    controls.appendChild(offsetLabel);
    controls.appendChild(rangeLabel);
    controls.appendChild(presetLabel);
    viewerCard.appendChild(controls);

    const viewerContent = document.createElement('div');
    viewerContent.className = 'memory-hex memory-static-hex';
    viewerCard.appendChild(viewerContent);

    const updatePresetState = () => {
        if (presetSelect.value !== 'custom') {
            offsetInput.value = presetSelect.value;
        }
    };

    const previousValues = new Map();
    const highlightExpiry = new Map();
    const render = () => {
        const currentStart = parseInt(offsetInput.value, 16) || 0;
        const currentRange = parseInt(rangeInput.value, 10) || 512;
        const presetName = presetSelect.options[presetSelect.selectedIndex]?.text || 'Custom';
        label.textContent = `Memory viewer: Offset 0x${currentStart.toString(16).toUpperCase().padStart(4, '0')} | ${currentRange} words (${presetName})`;
        renderMemoryRange(viewerContent, currentStart, currentRange, previousValues, highlightExpiry);
    };

    presetSelect.addEventListener('change', () => {
        updatePresetState();
        render();
    });
    offsetInput.addEventListener('input', () => {
        presetSelect.value = 'custom';
        render();
    });
    rangeInput.addEventListener('change', render);

    render();
    collection.appendChild(viewerCard);

    activeMemoryViewers.push({viewerCard, render, highlightExpiry});

    removeBtn.addEventListener('click', () => {
        viewerCard.remove();
        // Remove the viewer from activeMemoryViewers
        const index = activeMemoryViewers.findIndex(v => v.viewerCard === viewerCard);
        if (index !== -1) {
            activeMemoryViewers.splice(index, 1);
        }
    });
}

function setupEventListeners() {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Initially disable execution buttons
    const stepBtn = document.getElementById('step-btn');
    const runBtn = document.getElementById('run-btn');
    stepBtn.disabled = true;
    runBtn.disabled = true;

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');

            // Enable execution buttons when switching to Simulator tab
            if (tabId === 'simulator-tab') {
                // Check if there's code in memory (simple check: if PC is 0 and some memory is non-zero)
                const hasCode = memory.memory.some(value => value !== 0);
                if (hasCode) {
                    stepBtn.disabled = false;
                    runBtn.disabled = false;
                    updateStatus('Ready to execute. Use Step or Run.', 'info');
                }
            }
        });
    });

    const assembleBtn = document.getElementById('assemble-btn');
    const resetBtn = document.getElementById('reset-btn');
    statusDisplay = document.getElementById('status-display');
    programStatusDisplay = document.getElementById('program-status-display');
    const clockSpeedInput = document.getElementById('clock-speed');
    clockSpeedInput.max = 3 * Math.log2(1000000000) + 2;
    clockSpeedInput.value = 1 / 2 * clockSpeedInput.max;
    setClockDisplay();

    const editor = document.getElementById('editor');

    // Memory viewer controls
    const memoryOffset = document.getElementById('memory-offset');
    const memoryRange = document.getElementById('memory-range');
    const memoryPreset = document.getElementById('memory-preset');
    const addMemoryViewerBtn = document.getElementById('add-memory-viewer');

    createMemorySnapshotViewer(0, 256, false);
    addMemoryViewerBtn.addEventListener('click', () => {
        createMemorySnapshotViewer(0, 256);
    });

    // Register format selector
    const registerFormat = document.getElementById('register-format');
    registerFormat.addEventListener('change', updateRegisterDisplay);

    assembleBtn.addEventListener('click', () => {
        stopExecution();
        try {
            let code = editor.innerText || editor.textContent;
            // Normalize line endings and clean up the code
            code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const machineCode = assembler.assemble(code);
            console.log('Machine code:', machineCode);

            // Reset memory and CPU state before loading a new ROM
            memory.reset();
            resetCpuState();

            // Load machine code into memory starting at address 0
            memory.load(Array.from(new Uint16Array(machineCode.buffer)))
            programLength = machineCode.usedAddresses.findIndex(x => !x) + 1;

            updateStatus(`ROM flashed with ${machineCode.instructionCount} instructions. Switch to Simulator tab to execute.`, 'success');

            updateRegisterDisplay();
            updateMemoryDisplay();
            updateProgramView();
            updateExecutionCounters();

            // Keep buttons disabled until user switches to Simulator tab
            stepBtn.disabled = true;
            runBtn.disabled = true;

        } catch (error) {
            updateStatus(`Assembly error: ${error.message}`, 'error');
            stepBtn.disabled = true;
            runBtn.disabled = true;
            throw error
        }
    });

    stepBtn.addEventListener('click', () => {
        if (isRunning) {
            stopExecution();
            updateStatus('Execution paused. Stepping one instruction.', 'info');
        }
        clearAllHighlights();
        try {
            cpu.step();
            updateRegisterDisplay();
            updateMemoryDisplay();
            updateProgramView();
            updateExecutionCounters();
            updateStatus(`Executed instruction at PC=0x${cpu.registers.PC.toString(16).toUpperCase().padStart(4, '0')}`, 'info');
        } catch (error) {
            updateStatus(`Execution error: ${error.message}`, 'error');
        }
    });

    runBtn.addEventListener('click', () => {
        if (isRunning) {
            stopExecution();
            updateStatus('Execution stopped.', 'info');
            return;
        }
        const currentPC = cpu.registers.PC;
        if (breakpoints.has(currentPC)) {
            resumeBreakpointOnce = true;
        }
        startExecution();
    });

    clockSpeedInput.addEventListener('input', () => {
        setClockDisplay();
        if (isRunning) {
            stopExecution();
            startExecution();
        }
    });

    resetBtn.addEventListener('click', () => {
        resetCpuState();
        updateRegisterDisplay();
        updateMemoryDisplay();
        updateProgramView();
        updateExecutionCounters();
        updateStatus('CPU state reset. ROM preserved.', 'info');
        stepBtn.disabled = false;
        runBtn.disabled = false;
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);