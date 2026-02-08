import './style.scss';

// Note that a dynamic `import` statement here is required due to
// webpack/webpack#6615, but in theory `import { greet } from './pkg';`
// will work here one day as well!
const rust = import('../public/pkg/index').then(async (m) => {
    await m.default();
    return m;
});

const HINT_ID: string = "hint";
const HINT_BUTTON_ID: string = "hint-button";
const PREV_HINT_BUTTON_ID: string = "prev-hint-button";
const NEXT_HINT_BUTTON_ID: string = "next-hint-button";
const FIND_ALL_BUTTON_ID: string = "find-all-button";
const BOARD_TABLE_ID: string = "board-table";
const BOARD_PANEL_ID: string = "board-panel";
const MONTH_FORM_ID: string = "month-form";
const DAY_FORM_ID: string = "day-form";
const WEEKDAY_FORM_ID: string = "weekday-form";
const ALLOW_FLIP_TOGGLE_ID: string = "allow-flip-toggle";
const PUZZLE_TYPE_FORM_ID: string = "puzzle-type-form";
const ALL_MODE_SUMMARY_ID: string = "all-mode-summary";
const SOLUTION_LIST_ID: string = "solution-list";
const SOLUTION_LIST_PANEL_ID: string = "solution-list-panel";
const ALL_SOLUTIONS_LIMIT = 20;
const ALL_SOLUTIONS_FETCH_LIMIT = ALL_SOLUTIONS_LIMIT + 1;

enum PuzzleType {
    DragonFjord,
    JarringWords,
    Tetromino,
    WeekDay
}

type Mode = "single" | "all";

type Prefill = {
    month: number;
    day: number;
    weekday: number;
    puzzleType: PuzzleType;
    mode: Mode;
};

let mode: Mode = "single";

let cachedKey: string | null = null;
let cachedTokens: string[][] | null = null;
let hintOrder: number[] = [];
let hintIndex = 0;
let usedFlip = false;

let allSolutionsCacheKey: string | null = null;
let allSolutions: string[][][] = [];
let allSolutionOrigins: ("non-flip" | "flip-only")[] = [];
let selectedSolutionIndex = 0;
let allSolutionsTruncated = false;
let allSolutionsNonFlipCount = 0;
let allSolutionsFlipOnlyCount = 0;
let allModeSuggestEnableFlip = false;

function parsePuzzleType(raw: string | null): PuzzleType | null {
    if (!raw) {
        return null;
    }
    const trimmed = raw.trim();
    if (trimmed === "") {
        return null;
    }
    const numeric = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(numeric) && numeric >= PuzzleType.DragonFjord && numeric <= PuzzleType.WeekDay) {
        return numeric as PuzzleType;
    }
    const key = trimmed.toLowerCase().replace(/[\s-_']/g, "");
    switch (key) {
        case "dragonfjord":
        case "apuzzleaday":
        case "apuzzleadaydragonfjord":
            return PuzzleType.DragonFjord;
        case "jarringwords":
        case "calendarpuzzle":
            return PuzzleType.JarringWords;
        case "therammer":
        case "tetromino":
        case "tetrominopuzzle":
            return PuzzleType.Tetromino;
        case "weekday":
        case "weekdaycalendar":
        case "weekdaycalendarpuzzle":
            return PuzzleType.WeekDay;
        default:
            return null;
    }
}

function parseWeekday(raw: string | null): number | null {
    if (!raw) {
        return null;
    }
    const trimmed = raw.trim();
    if (trimmed === "") {
        return null;
    }
    const numeric = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(numeric) && numeric >= 0 && numeric <= 6) {
        return numeric;
    }
    const key = trimmed.toLowerCase();
    const map: { [key: string]: number } = {
        "sun": 0, "sunday": 0,
        "mon": 1, "monday": 1,
        "tue": 2, "tues": 2, "tuesday": 2,
        "wed": 3, "wednesday": 3,
        "thu": 4, "thur": 4, "thurs": 4, "thursday": 4,
        "fri": 5, "friday": 5,
        "sat": 6, "saturday": 6,
    };
    return map[key] ?? null;
}

function parseMonthDay(params: URLSearchParams): { month: number; day: number } | null {
    const dateRaw = params.get("date");
    if (dateRaw) {
        const match = dateRaw.trim().match(/^(\d{1,2})-(\d{1,2})$/);
        if (match) {
            const month = Number.parseInt(match[1], 10);
            const day = Number.parseInt(match[2], 10);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return { month, day };
            }
        }
    }
    const monthRaw = params.get("month") ?? params.get("m");
    const dayRaw = params.get("day") ?? params.get("d");
    if (monthRaw && dayRaw) {
        const month = Number.parseInt(monthRaw, 10);
        const day = Number.parseInt(dayRaw, 10);
        if (!Number.isNaN(month) && !Number.isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return { month, day };
        }
    }
    return null;
}

function parseMode(raw: string | null): Mode | null {
    if (!raw) {
        return null;
    }
    const key = raw.trim().toLowerCase();
    if (key === "all") {
        return "all";
    }
    if (key === "single") {
        return "single";
    }
    return null;
}

function parsePrefill(today: Date): Prefill {
    const params = new URLSearchParams(window.location.search);
    const puzzleType = parsePuzzleType(
        params.get("type") ?? params.get("puzzle") ?? params.get("puzzleType") ?? params.get("puzzle_type")
    ) ?? PuzzleType.DragonFjord;
    const monthDay = parseMonthDay(params);
    const month = monthDay?.month ?? (today.getMonth() + 1);
    const day = monthDay?.day ?? today.getDate();
    const weekday = parseWeekday(params.get("weekday") ?? params.get("w")) ?? today.getDay();
    const parsedMode = parseMode(params.get("mode"));

    return { month, day, weekday, puzzleType, mode: parsedMode ?? "single" };
}

function getCurrentSelection(): { month: number; day: number; weekday: number; puzzleType: PuzzleType } {
    const m_form =<HTMLSelectElement>document.getElementById(MONTH_FORM_ID);
    const month = m_form.selectedIndex + 1;
    const d_form =<HTMLSelectElement>document.getElementById(DAY_FORM_ID);
    const day = d_form.selectedIndex + 1;
    const w_form =<HTMLSelectElement>document.getElementById(WEEKDAY_FORM_ID);
    const weekday = w_form.selectedIndex;
    const p_form =<HTMLSelectElement>document.getElementById(PUZZLE_TYPE_FORM_ID);
    const puzzleType = p_form.selectedIndex as PuzzleType;

    return { month, day, weekday, puzzleType };
}

function isAllowFlipEnabled(): boolean {
    const toggle = <HTMLInputElement>document.getElementById(ALLOW_FLIP_TOGGLE_ID);
    return toggle?.checked ?? true;
}

function getRequestKey(month: number, day: number, weekday: number, puzzle_type: PuzzleType, allowFlip: boolean): string {
    return `${puzzle_type}-${month}-${day}-${weekday}-${allowFlip ? "flip" : "noflip"}`;
}

function parseBoard(board_str: string): string[][] {
    const board: string[][] = [];
    const lines = board_str.trim().split("\n");
    for (const line of lines) {
        const cs = line.trim().split(/\s+/);
        if (cs.length > 0 && cs[0] !== "") {
            board.push(cs);
        }
    }
    return board;
}

function parseBoardsJson(json: string): string[][][] {
    const boards = JSON.parse(json) as string[];
    return boards.map((s) => parseBoard(s));
}

function serializeBoardTokens(board: string[][]): string {
    return board.map((row) => row.join(" ")).join("\n");
}

function mergeSolutionsNonFlipFirst(
    nonFlipBoards: string[][][],
    flipBoards: string[][][],
    limit: number,
): {
    merged: string[][][];
    origins: ("non-flip" | "flip-only")[];
    nonFlipCount: number;
    flipOnlyCount: number;
    truncated: boolean;
} {
    const merged: string[][][] = [];
    const origins: ("non-flip" | "flip-only")[] = [];
    const seen = new Set<string>();
    let nonFlipCount = 0;
    let flipOnlyCount = 0;
    let truncated = false;

    for (const board of nonFlipBoards) {
        const key = serializeBoardTokens(board);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        nonFlipCount += 1;
        if (merged.length >= limit) {
            truncated = true;
            continue;
        }
        merged.push(board);
        origins.push("non-flip");
    }

    for (const board of flipBoards) {
        const key = serializeBoardTokens(board);
        if (seen.has(key)) {
            continue;
        }
        if (merged.length >= limit) {
            truncated = true;
            continue;
        }
        seen.add(key);
        merged.push(board);
        origins.push("flip-only");
        flipOnlyCount += 1;
    }

    return { merged, origins, nonFlipCount, flipOnlyCount, truncated };
}

function extractPieceIds(tokens: string[][]): number[] {
    const ids = new Set<number>();
    for (const row of tokens) {
        for (const cell of row) {
            if (/^\d+$/.test(cell)) {
                ids.add(Number.parseInt(cell, 10));
            }
        }
    }
    return Array.from(ids);
}

function shuffle(ids: number[]): number[] {
    const arr = ids.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function applyReveal(tokens: string[][], revealSet?: Set<number>): string[][] {
    if (!revealSet) {
        return tokens.map(row => row.slice());
    }
    return tokens.map(row => row.map(cell => {
        if (/^\d+$/.test(cell)) {
            const id = Number.parseInt(cell, 10);
            return revealSet.has(id) ? cell : ".";
        }
        return cell;
    }));
}

function setButtonDisabled(id: string, disabled: boolean) {
    const button = document.getElementById(id) as HTMLButtonElement | null;
    if (!button) {
        return;
    }
    button.disabled = disabled;
    button.classList.toggle("is-disabled", disabled);
}

function setHintEnabled(enabled: boolean) {
    setButtonDisabled(HINT_BUTTON_ID, !enabled);
    setButtonDisabled(PREV_HINT_BUTTON_ID, !enabled);
    setButtonDisabled(NEXT_HINT_BUTTON_ID, !enabled);
}

function clearAllModeView() {
    const boardLayout = document.getElementById("board");
    boardLayout?.classList.remove("is-all-mode");
    allSolutionOrigins = [];
    allSolutionsNonFlipCount = 0;
    allSolutionsFlipOnlyCount = 0;
    allSolutionsTruncated = false;
    allModeSuggestEnableFlip = false;
    const summary = document.getElementById(ALL_MODE_SUMMARY_ID);
    if (summary) {
        summary.textContent = "";
        summary.classList.remove("is-visible");
    }
    const solutionList = document.getElementById(SOLUTION_LIST_ID);
    if (solutionList) {
        solutionList.innerHTML = "";
    }
    const solutionPanel = document.getElementById(SOLUTION_LIST_PANEL_ID);
    solutionPanel?.classList.remove("is-visible");
}

function resetBoard() {
    let hint = document.getElementById(HINT_ID);
    if (hint) {
        hint.textContent = "";
    }
    const hintButton = document.getElementById(HINT_BUTTON_ID);
    hintButton?.classList.remove("is-hidden");
    setButtonDisabled(HINT_BUTTON_ID, false);
    const prevHintButton = document.getElementById(PREV_HINT_BUTTON_ID);
    prevHintButton?.classList.remove("is-visible");
    setButtonDisabled(PREV_HINT_BUTTON_ID, true);
    const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
    nextHintButton?.classList.remove("is-visible");
    setButtonDisabled(NEXT_HINT_BUTTON_ID, true);
    const table = <HTMLTableElement>document.getElementById(BOARD_TABLE_ID);
    table.textContent = "";
    table.classList.remove("board-table-visible");
    clearAllModeView();
    const boardCard = document.querySelector(".board-card");
    boardCard?.classList.remove("is-visible");
}

function renderSummary(text: string) {
    const summary = document.getElementById(ALL_MODE_SUMMARY_ID);
    if (!summary) {
        return;
    }
    summary.textContent = text;
    summary.classList.add("is-visible");
}

function focusBoardView() {
    const boardPanel = document.getElementById(BOARD_PANEL_ID) as HTMLElement | null;
    if (!boardPanel) {
        return;
    }
    const boardCard = boardPanel.closest(".board-card") as HTMLElement | null;
    const scrollTarget = boardCard ?? boardPanel;
    scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
    boardPanel.focus({ preventScroll: true });
}

function renderSolutionList(
    solutions: string[][][],
    origins: ("non-flip" | "flip-only")[],
    selectedIdx: number,
    onSelect: (idx: number) => void,
) {
    const panel = document.getElementById(SOLUTION_LIST_PANEL_ID);
    const list = document.getElementById(SOLUTION_LIST_ID);
    if (!panel || !list) {
        return;
    }

    list.innerHTML = "";
    if (solutions.length === 0) {
        panel.classList.remove("is-visible");
        return;
    }

    panel.classList.add("is-visible");
    for (let i = 0; i < solutions.length; i++) {
        const btn = document.createElement("button");
        btn.className = "solution-item";
        if (i === selectedIdx) {
            btn.classList.add("is-active");
        }
        const origin = origins[i] ?? "non-flip";
        btn.textContent = origin === "flip-only" ? `Solution ${i + 1} (allow flipping)` : `Solution ${i + 1}`;
        btn.onclick = () => onSelect(i);
        list.appendChild(btn);
    }
}

async function solveAndCache(
    month: number,
    day: number,
    weekday: number,
    puzzle_type: PuzzleType,
    allowFlip: boolean,
): Promise<string[][] | null> {
    if (!(1 <= month && month <= 12 && 1 <= day && day <= 31 && 0 <= weekday && weekday < 7)) {
        throw new Error("Error: invalid date: " + month + ", " + day);
    }

    const key = getRequestKey(month, day, weekday, puzzle_type, allowFlip);
    if (cachedKey !== key) {
        cachedKey = key;
        cachedTokens = null;
        hintOrder = [];
        hintIndex = 0;
        usedFlip = false;
        const hint = document.getElementById(HINT_ID);
        if (hint) {
            hint.textContent = "";
        }
    }

    if (cachedTokens) {
        return cachedTokens;
    }

    let r = await rust.then(m => {
        return m.find_solution(month, day, weekday, puzzle_type, false /* allow_flip */);
    });
    if (r != "") {
        usedFlip = false;
        cachedTokens = parseBoard(r);
        hintOrder = shuffle(extractPieceIds(cachedTokens));
        return cachedTokens;
    }

    if (!allowFlip) {
        const flipOnly = await rust.then(m => {
            return m.find_solution(month, day, weekday, puzzle_type, true);
        });
        const hint = document.getElementById(HINT_ID);
        if (hint) {
            hint.textContent = flipOnly != ""
                ? "No solution without flipping pieces. Enable \"Allow piece flipping\"."
                : "No solution found. Try enabling \"Allow piece flipping\".";
        }
        cachedTokens = null;
        hintOrder = [];
        hintIndex = 0;
        usedFlip = false;
        return null;
    }

    if (allowFlip) {
        r = await rust.then(m => {
            return m.find_solution(month, day, weekday, puzzle_type, true);
        });
        if (r != "") {
            usedFlip = true;
            cachedTokens = parseBoard(r);
            hintOrder = shuffle(extractPieceIds(cachedTokens));
            return cachedTokens;
        }
    }

    cachedTokens = null;
    hintOrder = [];
    hintIndex = 0;
    usedFlip = false;
    const hint = document.getElementById(HINT_ID);
    if (hint) {
        hint.textContent = "No solution found.";
    }
    return null;
}

async function findAllSolutionsAndCache(
    month: number,
    day: number,
    weekday: number,
    puzzleType: PuzzleType,
    allowFlip: boolean,
): Promise<string[][][]> {
    if (!(1 <= month && month <= 12 && 1 <= day && day <= 31 && 0 <= weekday && weekday < 7)) {
        throw new Error("Error: invalid date: " + month + ", " + day);
    }

    const key = getRequestKey(month, day, weekday, puzzleType, allowFlip);
    if (allSolutionsCacheKey === key) {
        return allSolutions;
    }

    const nonFlipJson = await rust.then(m =>
        m.find_solutions(month, day, weekday, puzzleType, false, ALL_SOLUTIONS_FETCH_LIMIT)
    );
    const nonFlipBoards = parseBoardsJson(nonFlipJson);
    allModeSuggestEnableFlip = false;

    let mergedResult = mergeSolutionsNonFlipFirst(
        nonFlipBoards,
        [],
        ALL_SOLUTIONS_LIMIT,
    );

    if (allowFlip) {
        const flipJson = await rust.then(m =>
            m.find_solutions(month, day, weekday, puzzleType, true, ALL_SOLUTIONS_FETCH_LIMIT)
        );
        const flipBoards = parseBoardsJson(flipJson);
        mergedResult = mergeSolutionsNonFlipFirst(
            nonFlipBoards,
            flipBoards,
            ALL_SOLUTIONS_LIMIT,
        );
        if (flipBoards.length > ALL_SOLUTIONS_LIMIT) {
            mergedResult.truncated = true;
        }
    } else if (nonFlipBoards.length === 0) {
        const flipProbeJson = await rust.then(m =>
            m.find_solutions(month, day, weekday, puzzleType, true, 1)
        );
        const flipProbeBoards = parseBoardsJson(flipProbeJson);
        allModeSuggestEnableFlip = flipProbeBoards.length > 0;
    }

    if (nonFlipBoards.length > ALL_SOLUTIONS_LIMIT) {
        mergedResult.truncated = true;
    }

    allSolutions = mergedResult.merged;
    allSolutionOrigins = mergedResult.origins;
    allSolutionsNonFlipCount = mergedResult.nonFlipCount;
    allSolutionsFlipOnlyCount = mergedResult.flipOnlyCount;
    allSolutionsTruncated = mergedResult.truncated;
    allSolutionsCacheKey = key;
    selectedSolutionIndex = 0;

    return allSolutions;
}

function renderAllMode(month: number, day: number, weekday: number) {
    const boardLayout = document.getElementById("board");
    boardLayout?.classList.add("is-all-mode");
    const boardCard = document.querySelector(".board-card");
    boardCard?.classList.add("is-visible");

    if (allSolutions.length === 0) {
        const allowFlip = isAllowFlipEnabled();
        renderSummary(!allowFlip && allModeSuggestEnableFlip
            ? "No solution without flipping pieces. Enable \"Allow piece flipping\"."
            : "No solution found.");
        const table = <HTMLTableElement>document.getElementById(BOARD_TABLE_ID);
        table.textContent = "";
        table.classList.remove("board-table-visible");
        renderSolutionList([], [], 0, () => undefined);
        return;
    }

    const allowFlip = isAllowFlipEnabled();
    const nonFlipLabel = allSolutionsNonFlipCount >= ALL_SOLUTIONS_LIMIT
        ? `${ALL_SOLUTIONS_LIMIT}+`
        : `${allSolutionsNonFlipCount}`;
    const hasTruncatedLabel = allSolutionsTruncated || allSolutionsNonFlipCount >= ALL_SOLUTIONS_LIMIT;
    let summaryText = "";
    if (allowFlip) {
        if (hasTruncatedLabel) {
            summaryText = `Found ${ALL_SOLUTIONS_LIMIT}+ solutions (non-flip: ${nonFlipLabel}). Showing first ${ALL_SOLUTIONS_LIMIT}.`;
        } else {
            summaryText = `Found ${allSolutions.length} solutions (non-flip: ${nonFlipLabel}, allow flipping: ${allSolutionsFlipOnlyCount}).`;
        }
    } else {
        if (hasTruncatedLabel) {
            summaryText = `Found ${ALL_SOLUTIONS_LIMIT}+ solutions (non-flip: ${nonFlipLabel}). Showing first ${ALL_SOLUTIONS_LIMIT}.`;
        } else {
            summaryText = `Found ${allSolutions.length} solutions (non-flip: ${nonFlipLabel}).`;
        }
    }
    renderSummary(summaryText);

    renderSolutionList(allSolutions, allSolutionOrigins, selectedSolutionIndex, (idx) => {
        selectedSolutionIndex = idx;
        renderAllMode(month, day, weekday);
    });

    const selected = allSolutions[selectedSolutionIndex] ?? allSolutions[0];
    renderTable(month, day, weekday, selected, selected);
}

function markAllModeStaleIfNeeded() {
    if (mode !== "all") {
        return;
    }
    const { month, day, weekday, puzzleType } = getCurrentSelection();
    const key = getRequestKey(month, day, weekday, puzzleType, isAllowFlipEnabled());
    if (allSolutionsCacheKey === key) {
        return;
    }
    clearAllModeView();
    const table = <HTMLTableElement>document.getElementById(BOARD_TABLE_ID);
    table.textContent = "";
    table.classList.remove("board-table-visible");
    mode = "single";
    setHintEnabled(true);
    renderSummary("Settings changed. Click \"Solve!\" again to refresh.");
}

function onFindAllClick() {
    mode = "all";
    resetBoard();
    setButtonDisabled(PREV_HINT_BUTTON_ID, true);
    setButtonDisabled(NEXT_HINT_BUTTON_ID, true);
    const { month, day, weekday, puzzleType } = getCurrentSelection();
    const allowFlip = isAllowFlipEnabled();
    renderSummary("Searching solutions (20+ possible)...");
    window.requestAnimationFrame(() => {
        findAllSolutionsAndCache(month, day, weekday, puzzleType, allowFlip)
            .then(() => {
                renderAllMode(month, day, weekday);
                focusBoardView();
            })
            .catch((_e) => {
                renderSummary("Could not load solutions. Please try again.");
            });
    });
}

function addOptions(prefill: Prefill) {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const m_form =<HTMLSelectElement>document.getElementById(MONTH_FORM_ID);
    months.forEach(m => {
        const opt = document.createElement("option");
        opt.text = m;
        m_form.add(opt);
    });
    m_form.selectedIndex = Math.min(Math.max(prefill.month, 1), 12) - 1;

    const d_form =<HTMLSelectElement>document.getElementById(DAY_FORM_ID);
    for (let i = 1; i <= 31; i++) {
        const opt = document.createElement("option");
        opt.text = i.toString();
        d_form.add(opt);
    }
    d_form.selectedIndex = Math.min(Math.max(prefill.day, 1), 31) - 1;

    const w_form =<HTMLSelectElement>document.getElementById(WEEKDAY_FORM_ID);
    weekdays.forEach(w => {
        const opt = document.createElement("option");
        opt.text = w;
        w_form.add(opt);
    });
    w_form.selectedIndex = Math.min(Math.max(prefill.weekday, 0), 6);
    w_form.disabled = true;

    const p_form =<HTMLSelectElement>document.getElementById(PUZZLE_TYPE_FORM_ID);
    ["DragonFjord's A-Puzzle-A-Day", "JarringWords's Calendar Puzzle", "TheRammer Puzzle Calendar", "WeekDay Calendar Puzzle"].forEach(typ => {
        const opt = document.createElement("option");
        opt.text = typ;
        p_form.add(opt);
    });
    p_form.selectedIndex = prefill.puzzleType;
}

function onChangePuzzleType() {
    const p_form =<HTMLSelectElement>document.getElementById(PUZZLE_TYPE_FORM_ID);
    const w_form =<HTMLSelectElement>document.getElementById(WEEKDAY_FORM_ID);
    if (p_form.selectedIndex == PuzzleType.WeekDay) {
        w_form.disabled = false;
    } else {
        w_form.disabled = true;
    }
    markAllModeStaleIfNeeded();
}

function renderTable(
    month: number,
    day: number,
    weekday: number,
    boardTokens: string[][],
    outlineTokens?: string[][]
) {
    const HEIGHT = 8;
    const WIDTH = 7;
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const COLOR_DICT: { [key: string]: string } = {
        "0": "crimson",
        "1": "pink",
        "2": "indigo",
        "3": "cyan",
        "4": "teal",
        "5": "green",
        "6": "palegoldenrod",
        "7": "orange",
        "8": "gray",
        "9": "slateblue",
        "M": "tan",
        "D": "tan",
        "W": "tan",
        "#": "transparent",
        ".": "transparent",
    };

    const board = boardTokens;
    const outlineBoard = outlineTokens ?? boardTokens;
    if (board.length != HEIGHT) {
        console.log("unexpected board height: ", board.length, board);
    }

    const table = <HTMLTableElement>document.getElementById(BOARD_TABLE_ID);
    table.textContent = "";
    table.classList.add("board-table-visible");
    const boardCard = document.querySelector(".board-card");
    boardCard?.classList.add("is-visible");
    for (let i = 0; i < HEIGHT; i++) {
        let row = <HTMLTableRowElement>table.insertRow(i);
        for (let j = 0; j < WIDTH; j++) {
            let cell = row.insertCell(j);
            let div = document.createElement("div");
            div.className = "cell";
            let color = COLOR_DICT[board[i][j]];
            div.style.backgroundColor = color;
            if (board[i][j] === "#" || board[i][j] === ".") {
                div.classList.add("cell-empty");
            }

            const isOutlineCell = (token: string) => {
                if (/^\d+$/.test(token)) {
                    return true;
                }
                return token === "M" || token === "D" || token === "W";
            };

            if (isOutlineCell(outlineBoard[i][j])) {
                const up = i > 0 ? outlineBoard[i - 1][j] : "#";
                const down = i < HEIGHT - 1 ? outlineBoard[i + 1][j] : "#";
                const left = j > 0 ? outlineBoard[i][j - 1] : "#";
                const right = j < WIDTH - 1 ? outlineBoard[i][j + 1] : "#";

                if (!isOutlineCell(up)) {
                    div.classList.add("cell-outline-top");
                }
                if (!isOutlineCell(down)) {
                    div.classList.add("cell-outline-bottom");
                }
                if (!isOutlineCell(left)) {
                    div.classList.add("cell-outline-left");
                }
                if (!isOutlineCell(right)) {
                    div.classList.add("cell-outline-right");
                }
            }

            if (board[i][j] === "M") {
                div.textContent = MONTHS[month-1].toString();
            } else if (board[i][j] === "D") {
                div.textContent = day.toString();
            }else if (board[i][j] === "W") {
                div.textContent = WEEKDAYS[weekday].toString();
            }

            cell.appendChild(div);
        }
    }
}

function onHintClick() {
    if (mode === "all") {
        mode = "single";
        setHintEnabled(true);
        clearAllModeView();
    }
    hintIndex = 0;
    const summary = document.getElementById(ALL_MODE_SUMMARY_ID);
    if (summary) {
        summary.textContent = "";
        summary.classList.remove("is-visible");
    }
    const { month, day, weekday, puzzleType } = getCurrentSelection();
    solveAndCache(month, day, weekday, puzzleType, isAllowFlipEnabled()).then(tokens => {
        if (!tokens) {
            return;
        }
        if (hintIndex >= hintOrder.length) {
            const hint = document.getElementById(HINT_ID);
            if (hint) {
                hint.textContent = "All pieces are revealed.";
            }
            renderTable(month, day, weekday, tokens, tokens);
            focusBoardView();
            setButtonDisabled(NEXT_HINT_BUTTON_ID, true);
            return;
        }

        if (hintOrder.length === 0) {
            renderTable(month, day, weekday, tokens, tokens);
            focusBoardView();
            return;
        }

        hintIndex += 1;
        const revealSet = new Set(hintOrder.slice(0, hintIndex));
        const masked = applyReveal(tokens, revealSet);
        renderTable(month, day, weekday, masked, tokens);
        focusBoardView();

        const hint = document.getElementById(HINT_ID);
        if (hint) {
            const flipNote = usedFlip ? " (flipping used)" : "";
            hint.textContent = `Hint ${hintIndex} of ${hintOrder.length}${flipNote}`;
        }

        setButtonDisabled(HINT_BUTTON_ID, false);
        const prevHintButton = document.getElementById(PREV_HINT_BUTTON_ID);
        prevHintButton?.classList.add("is-visible");
        setButtonDisabled(PREV_HINT_BUTTON_ID, true);
        const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
        nextHintButton?.classList.add("is-visible");
        setButtonDisabled(NEXT_HINT_BUTTON_ID, false);
        if (hintIndex >= hintOrder.length) {
            setButtonDisabled(NEXT_HINT_BUTTON_ID, true);
        }
    });
}

function onNextHintClick() {
    if (mode === "all") {
        return;
    }
    if (hintIndex === 0) {
        onHintClick();
        return;
    }
    const { month, day, weekday, puzzleType } = getCurrentSelection();
    solveAndCache(month, day, weekday, puzzleType, isAllowFlipEnabled()).then(tokens => {
        if (!tokens) {
            return;
        }
        if (hintOrder.length === 0) {
            renderTable(month, day, weekday, tokens, tokens);
            focusBoardView();
            return;
        }
        if (hintIndex >= hintOrder.length) {
            const hint = document.getElementById(HINT_ID);
            if (hint) {
                hint.textContent = "All pieces are revealed.";
            }
            renderTable(month, day, weekday, tokens, tokens);
            focusBoardView();
            setButtonDisabled(NEXT_HINT_BUTTON_ID, true);
            return;
        }

        hintIndex += 1;
        const revealSet = new Set(hintOrder.slice(0, hintIndex));
        const masked = applyReveal(tokens, revealSet);
        renderTable(month, day, weekday, masked, tokens);
        focusBoardView();

        const hint = document.getElementById(HINT_ID);
        if (hint) {
            const flipNote = usedFlip ? " (flipping used)" : "";
            hint.textContent = `Hint ${hintIndex} of ${hintOrder.length}${flipNote}`;
        }

        const prevHintButton = document.getElementById(PREV_HINT_BUTTON_ID);
        prevHintButton?.classList.add("is-visible");
        setButtonDisabled(PREV_HINT_BUTTON_ID, false);
        const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
        nextHintButton?.classList.add("is-visible");
        setButtonDisabled(NEXT_HINT_BUTTON_ID, false);
        if (hintIndex >= hintOrder.length) {
            setButtonDisabled(NEXT_HINT_BUTTON_ID, true);
        }
    });
}

function onPrevHintClick() {
    if (mode === "all") {
        return;
    }
    if (hintIndex <= 1) {
        hintIndex = 0;
        const hint = document.getElementById(HINT_ID);
        if (hint) {
            hint.textContent = "";
        }
        const { month, day, weekday, puzzleType } = getCurrentSelection();
        solveAndCache(month, day, weekday, puzzleType, isAllowFlipEnabled()).then(tokens => {
            if (!tokens) {
                return;
            }
            const masked = applyReveal(tokens, new Set());
            renderTable(month, day, weekday, masked, tokens);
            focusBoardView();
            const hintButton = document.getElementById(HINT_BUTTON_ID);
            hintButton?.classList.remove("is-hidden");
            const prevHintButton = document.getElementById(PREV_HINT_BUTTON_ID);
            prevHintButton?.classList.remove("is-visible");
            setButtonDisabled(PREV_HINT_BUTTON_ID, true);
            const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
            nextHintButton?.classList.remove("is-visible");
            setButtonDisabled(NEXT_HINT_BUTTON_ID, true);
        });
        return;
    }
    hintIndex -= 1;
    const { month, day, weekday, puzzleType } = getCurrentSelection();
    solveAndCache(month, day, weekday, puzzleType, isAllowFlipEnabled()).then(tokens => {
        if (!tokens) {
            return;
        }
        const revealSet = new Set(hintOrder.slice(0, hintIndex));
        const masked = applyReveal(tokens, revealSet);
        renderTable(month, day, weekday, masked, tokens);
        focusBoardView();
        const hint = document.getElementById(HINT_ID);
        if (hint) {
            const flipNote = usedFlip ? " (flipping used)" : "";
            hint.textContent = `Hint ${hintIndex} of ${hintOrder.length}${flipNote}`;
        }
        const prevHintButton = document.getElementById(PREV_HINT_BUTTON_ID);
        prevHintButton?.classList.add("is-visible");
        setButtonDisabled(PREV_HINT_BUTTON_ID, false);
        const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
        nextHintButton?.classList.add("is-visible");
        setButtonDisabled(NEXT_HINT_BUTTON_ID, false);
    });
}

function initialize() {
    document.getElementById(PUZZLE_TYPE_FORM_ID)!.onchange = onChangePuzzleType;
    document.getElementById(MONTH_FORM_ID)!.onchange = markAllModeStaleIfNeeded;
    document.getElementById(DAY_FORM_ID)!.onchange = markAllModeStaleIfNeeded;
    document.getElementById(WEEKDAY_FORM_ID)!.onchange = markAllModeStaleIfNeeded;
    document.getElementById(ALLOW_FLIP_TOGGLE_ID)!.onchange = markAllModeStaleIfNeeded;
    document.getElementById(FIND_ALL_BUTTON_ID)!.onclick = onFindAllClick;
    document.getElementById(HINT_BUTTON_ID)!.onclick = onHintClick;
    document.getElementById(PREV_HINT_BUTTON_ID)!.onclick = onPrevHintClick;
    document.getElementById(NEXT_HINT_BUTTON_ID)!.onclick = onNextHintClick;

    const prefill = parsePrefill(new Date());
    addOptions(prefill);
    onChangePuzzleType();

    if (prefill.mode === "all") {
        onFindAllClick();
    }
}

initialize();
