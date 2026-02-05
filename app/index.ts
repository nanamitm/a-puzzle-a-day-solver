import './style.scss';

// Note that a dynamic `import` statement here is required due to
// webpack/webpack#6615, but in theory `import { greet } from './pkg';`
// will work here one day as well!
const rust = import('../public/pkg/index');

const HINT_ID: string = "hint";
const HINT_BUTTON_ID: string = "hint-button";
const PREV_HINT_BUTTON_ID: string = "prev-hint-button";
const NEXT_HINT_BUTTON_ID: string = "next-hint-button";
const BOARD_TABLE_ID: string = "board-table";
const MONTH_FORM_ID: string = "month-form";
const DAY_FORM_ID: string = "day-form";
const WEEKDAY_FORM_ID: string = "weekday-form";
const PUZZLE_TYPE_FORM_ID: string = "puzzle-type-form";
const SOLVE_BUTTON_ID: string = "solve-button";

enum PuzzleType {
    DragonFjord,
    JarringWords,
    Tetromino,
    WeekDay
}

type Prefill = {
    month: number;
    day: number;
    weekday: number;
    puzzleType: PuzzleType;
};

let cachedKey: string | null = null;
let cachedTokens: string[][] | null = null;
let hintOrder: number[] = [];
let hintIndex = 0;
let usedFlip = false;

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
        const match = dateRaw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (match) {
            const year = Number.parseInt(match[1], 10);
            const month = Number.parseInt(match[2], 10);
            const day = Number.parseInt(match[3], 10);
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

function parsePrefill(today: Date): Prefill {
    const params = new URLSearchParams(window.location.search);
    const puzzleType = parsePuzzleType(
        params.get("type") ?? params.get("puzzle") ?? params.get("puzzleType") ?? params.get("puzzle_type")
    ) ?? PuzzleType.DragonFjord;
    const monthDay = parseMonthDay(params);
    const month = monthDay?.month ?? (today.getMonth() + 1);
    const day = monthDay?.day ?? today.getDate();
    const weekday = parseWeekday(params.get("weekday") ?? params.get("w")) ?? today.getDay();

    return { month, day, weekday, puzzleType };
}

function buttonOnClick() {
    const { month, day, weekday, puzzleType } = getCurrentSelection();
    resetBoard();
    solveAndCache(month, day, weekday, puzzleType).then(tokens => {
        if (!tokens) {
            return;
        }
        renderTable(month, day, weekday, tokens, tokens);
        hintIndex = hintOrder.length;
        const hint = document.getElementById(HINT_ID);
        if (hint) {
            hint.innerText = usedFlip ? "(No solution without flipping pieces.)" : "";
        }
    });
}

function resetBoard() {
    let hint = document.getElementById(HINT_ID);
    if (hint) {
        hint.innerText = "";
    }
    const hintButton = document.getElementById(HINT_BUTTON_ID);
    hintButton?.classList.remove("is-disabled");
    hintButton?.classList.remove("is-hidden");
    const prevHintButton = document.getElementById(PREV_HINT_BUTTON_ID);
    prevHintButton?.classList.remove("is-visible");
    prevHintButton?.classList.remove("is-disabled");
    const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
    nextHintButton?.classList.remove("is-visible");
    nextHintButton?.classList.remove("is-disabled");
    const table = <HTMLTableElement>document.getElementById(BOARD_TABLE_ID);
    table.innerText = "";
    table.classList.remove("board-table-visible");
    const boardCard = document.querySelector(".board-card");
    boardCard?.classList.remove("is-visible");
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

function getRequestKey(month: number, day: number, weekday: number, puzzle_type: PuzzleType): string {
    return `${puzzle_type}-${month}-${day}-${weekday}`;
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

async function solveAndCache(month: number, day: number, weekday: number, puzzle_type: PuzzleType): Promise<string[][] | null> {
    if (!(1 <= month && month <= 12 && 1 <= day && day <= 31 && 0 <= weekday && weekday < 7)) {
        throw new Error("Error: invalid date: " + month + ", " + day);
    }

    const key = getRequestKey(month, day, weekday, puzzle_type);
    if (cachedKey !== key) {
        cachedKey = key;
        cachedTokens = null;
        hintOrder = [];
        hintIndex = 0;
        usedFlip = false;
        const hint = document.getElementById(HINT_ID);
        if (hint) {
            hint.innerText = "";
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

    r = await rust.then(m => {
        return m.find_solution(month, day, weekday, puzzle_type, true);
    });
    if (r != "") {
        usedFlip = true;
        cachedTokens = parseBoard(r);
        hintOrder = shuffle(extractPieceIds(cachedTokens));
        return cachedTokens;
    }

    cachedTokens = null;
    hintOrder = [];
    hintIndex = 0;
    usedFlip = false;
    const hint = document.getElementById(HINT_ID);
    if (hint) {
        hint.innerText = "No solution found.";
    }
    return null;
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
    const COLOR_DICT = {
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
    table.innerText = "";
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
                div.innerText = MONTHS[month-1].toString();
            } else if (board[i][j] === "D") {
                div.innerText = day.toString();
            }else if (board[i][j] === "W") {
                div.innerText = WEEKDAYS[weekday].toString();
            }

            cell.appendChild(div);
        }
    }
}

function onHintClick() {
    const { month, day, weekday, puzzleType } = getCurrentSelection();
    solveAndCache(month, day, weekday, puzzleType).then(tokens => {
        if (!tokens) {
            return;
        }
        if (hintIndex >= hintOrder.length) {
            const hint = document.getElementById(HINT_ID);
            if (hint) {
                hint.innerText = "All pieces revealed.";
            }
            renderTable(month, day, weekday, tokens, tokens);
            const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
            nextHintButton?.classList.add("is-disabled");
            return;
        }

        if (hintOrder.length === 0) {
            renderTable(month, day, weekday, tokens, tokens);
            return;
        }

        hintIndex += 1;
        const revealSet = new Set(hintOrder.slice(0, hintIndex));
        const masked = applyReveal(tokens, revealSet);
        renderTable(month, day, weekday, masked, tokens);

        const hint = document.getElementById(HINT_ID);
        if (hint) {
            const flipNote = usedFlip ? " (flip used)" : "";
            hint.innerText = `Hint ${hintIndex}/${hintOrder.length}${flipNote}`;
        }

        const hintButton = document.getElementById(HINT_BUTTON_ID);
        hintButton?.classList.add("is-hidden");
        hintButton?.classList.remove("is-disabled");
        const prevHintButton = document.getElementById(PREV_HINT_BUTTON_ID);
        prevHintButton?.classList.add("is-visible");
        prevHintButton?.classList.add("is-disabled");
        const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
        nextHintButton?.classList.add("is-visible");
        nextHintButton?.classList.remove("is-disabled");
        if (hintIndex >= hintOrder.length) {
            nextHintButton?.classList.add("is-disabled");
        }
    });
}

function onNextHintClick() {
    if (hintIndex === 0) {
        onHintClick();
        return;
    }
    const { month, day, weekday, puzzleType } = getCurrentSelection();
    solveAndCache(month, day, weekday, puzzleType).then(tokens => {
        if (!tokens) {
            return;
        }
        if (hintOrder.length === 0) {
            renderTable(month, day, weekday, tokens, tokens);
            return;
        }
        if (hintIndex >= hintOrder.length) {
            const hint = document.getElementById(HINT_ID);
            if (hint) {
                hint.innerText = "All pieces revealed.";
            }
            renderTable(month, day, weekday, tokens, tokens);
            const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
            nextHintButton?.classList.add("is-disabled");
            return;
        }

        hintIndex += 1;
        const revealSet = new Set(hintOrder.slice(0, hintIndex));
        const masked = applyReveal(tokens, revealSet);
        renderTable(month, day, weekday, masked, tokens);

        const hint = document.getElementById(HINT_ID);
        if (hint) {
            const flipNote = usedFlip ? " (flip used)" : "";
            hint.innerText = `Hint ${hintIndex}/${hintOrder.length}${flipNote}`;
        }

        const prevHintButton = document.getElementById(PREV_HINT_BUTTON_ID);
        prevHintButton?.classList.add("is-visible");
        prevHintButton?.classList.remove("is-disabled");
        const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
        nextHintButton?.classList.add("is-visible");
        if (hintIndex >= hintOrder.length) {
            nextHintButton?.classList.add("is-disabled");
        }
    });
}

function onPrevHintClick() {
    if (hintIndex <= 1) {
        hintIndex = 0;
        const hint = document.getElementById(HINT_ID);
        if (hint) {
            hint.innerText = "";
        }
        const { month, day, weekday, puzzleType } = getCurrentSelection();
        solveAndCache(month, day, weekday, puzzleType).then(tokens => {
            if (!tokens) {
                return;
            }
            const masked = applyReveal(tokens, new Set());
            renderTable(month, day, weekday, masked, tokens);
            const hintButton = document.getElementById(HINT_BUTTON_ID);
            hintButton?.classList.remove("is-hidden");
            const prevHintButton = document.getElementById(PREV_HINT_BUTTON_ID);
            prevHintButton?.classList.remove("is-visible");
            prevHintButton?.classList.add("is-disabled");
            const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
            nextHintButton?.classList.remove("is-visible");
        });
        return;
    }
    hintIndex -= 1;
    const { month, day, weekday, puzzleType } = getCurrentSelection();
    solveAndCache(month, day, weekday, puzzleType).then(tokens => {
        if (!tokens) {
            return;
        }
        const revealSet = new Set(hintOrder.slice(0, hintIndex));
        const masked = applyReveal(tokens, revealSet);
        renderTable(month, day, weekday, masked, tokens);
        const hint = document.getElementById(HINT_ID);
        if (hint) {
            const flipNote = usedFlip ? " (flip used)" : "";
            hint.innerText = `Hint ${hintIndex}/${hintOrder.length}${flipNote}`;
        }
        const prevHintButton = document.getElementById(PREV_HINT_BUTTON_ID);
        prevHintButton?.classList.add("is-visible");
        prevHintButton?.classList.remove("is-disabled");
        const nextHintButton = document.getElementById(NEXT_HINT_BUTTON_ID);
        nextHintButton?.classList.add("is-visible");
        nextHintButton?.classList.remove("is-disabled");
    });
}

function initialize() {
    document.getElementById(PUZZLE_TYPE_FORM_ID).onchange=onChangePuzzleType;
    document.getElementById(SOLVE_BUTTON_ID).onclick=buttonOnClick;
    document.getElementById(HINT_BUTTON_ID).onclick=onHintClick;
    document.getElementById(PREV_HINT_BUTTON_ID).onclick=onPrevHintClick;
    document.getElementById(NEXT_HINT_BUTTON_ID).onclick=onNextHintClick;

    const prefill = parsePrefill(new Date());
    addOptions(prefill);
    onChangePuzzleType();
}

initialize();
