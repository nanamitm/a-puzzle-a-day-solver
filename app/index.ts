import './style.scss';

// Note that a dynamic `import` statement here is required due to
// webpack/webpack#6615, but in theory `import { greet } from './pkg';`
// will work here one day as well!
const rust = import('../public/pkg/index');

const HINT_ID: string = "hint";
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
    const m_form =<HTMLSelectElement>document.getElementById(MONTH_FORM_ID);
    const month = m_form.selectedIndex + 1;
    const d_form =<HTMLSelectElement>document.getElementById(DAY_FORM_ID);
    const day = d_form.selectedIndex + 1;
    const w_form =<HTMLSelectElement>document.getElementById(WEEKDAY_FORM_ID);
    const weekday = w_form.selectedIndex;
    const p_form =<HTMLSelectElement>document.getElementById(PUZZLE_TYPE_FORM_ID);
    const puzzle_type = p_form.selectedIndex;

    resetBoard();

    callSolver(month, day, weekday, puzzle_type).then(result => {
        console.log(result);
        renderTable(month, day, weekday, result);
    })
}

function resetBoard() {
    let hint = document.getElementById(HINT_ID);
    hint.innerText = "";
}

async function callSolver(month: number, day: number, weekday: number, puzzle_type: PuzzleType): Promise<string> {
    if (!(1 <= month && month <= 12 && 1 <= day && day <= 31 && 0 <= weekday && weekday < 7)) {

        throw new Error("Error: invalid date: " + month + ", " + day);
    }

    // If there is a solution without flipping, return it.
    let r = await rust.then(m => {
        return m.find_solution(month, day, weekday, puzzle_type, false /* allow_flip */);
    });
    if (r != "") {
        return r;
    }

    let hint = document.getElementById(HINT_ID);
    hint.innerText = "(No solution without flipping pieces.)";

    return await rust.then(m => {
        return m.find_solution(month, day, weekday, puzzle_type, true);
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
}

function renderTable(month: number, day: number, weekday: number, board_str: string) {
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
        "M": "tan",
        "D": "tan",
        "#": "white",
    };

    let board = [];
    for (const l of board_str.trim().split("\n")) {
        const cs = l.trim().split(" ");
        if (cs.length != WIDTH) {
            console.log("unexpected board width: ", cs);
        }
        board.push(cs);
    }
    if (board.length != HEIGHT) {
        console.log("unexpected board height: ", board.length, board);
    }

    const table = <HTMLTableElement>document.getElementById(BOARD_TABLE_ID);
    table.innerText = "";
    for (let i = 0; i < HEIGHT; i++) {
        let row = <HTMLTableRowElement>table.insertRow(i);
        for (let j = 0; j < WIDTH; j++) {
            let cell = row.insertCell(j);
            let div = document.createElement("div");
            div.className = "cell";
            let color = COLOR_DICT[board[i][j]];
            div.style.backgroundColor = color;

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


function initialize() {
    document.getElementById(PUZZLE_TYPE_FORM_ID).onchange=onChangePuzzleType;
    document.getElementById(SOLVE_BUTTON_ID).onclick=buttonOnClick;

    const prefill = parsePrefill(new Date());
    addOptions(prefill);
    onChangePuzzleType();
}

initialize();
