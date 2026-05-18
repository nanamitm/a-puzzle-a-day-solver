use a_puzzle_a_day_lib::{Block, Board, Point, PuzzleType, SolverOptions, State, solve, request_cancel};
use std::time::Instant;

/// Board representation passed over FFI.
/// cells[row][col], 8 rows x 7 cols:
///   0    = empty
///   1-N  = piece ID (1-indexed)
///   0xFE = date / weekday marker cell
///   0xFF = permanent wall (off-board)
#[repr(C)]
#[derive(Clone, Copy)]
pub struct ApdBoard {
    pub cells: [[u8; 7]; 8],
}

#[repr(C)]
pub struct ApdSolveResult {
    pub solutions:  *mut ApdBoard,
    pub count:      usize,
    pub elapsed_ms: f64,
}

/// puzzle_type: 0=DragonFjord, 1=JarringWords, 2=Tetromino, 3=WeekDay
/// weekday:     0=Sun, 1=Mon, ..., 6=Sat  (only used when puzzle_type == 3)
///
/// Caller must free the returned result with apd_free_result.
#[no_mangle]
pub extern "C" fn apd_solve(
    month:       u32,
    day:         u32,
    weekday:     u32,
    puzzle_type: u32,
    allow_flip:  bool,
    find_all:    bool,
) -> ApdSolveResult {
    let t0 = Instant::now();

    let typ = match puzzle_type {
        1 => PuzzleType::JarringWords,
        2 => PuzzleType::Tetromino,
        3 => PuzzleType::WeekDay,
        _ => PuzzleType::DragonFjord,
    };

    let m = (month - 1) as usize;
    let month_pos = Point::new((m / 6) as i32, (m % 6) as i32);

    let day_pos = if typ == PuzzleType::Tetromino && day >= 29 {
        Point::new(6, (day - 25) as i32)
    } else {
        let x = (day - 1) / 7 + 2;
        let y = (day - 1) % 7;
        Point::new(x as i32, y as i32)
    };

    // weekday: 0=Sun, 1=Mon, ..., 6=Sat  (same as CLI WEEK_DAYS index)
    let week_pos = if typ == PuzzleType::WeekDay {
        let p = weekday as usize;
        let x = if p < 4 { 6i32 } else { 7i32 };
        let y = if p < 4 { (p + 3) as i32 } else { p as i32 };
        Some(Point::new(x, y))
    } else {
        None
    };

    let board  = Board::new_from_day_pos(month_pos, day_pos, week_pos, typ);
    let blocks = Block::get_blocks(typ);
    let opts   = SolverOptions {
        allow_flip,
        one_solution: !find_all,
        max_solutions: None,
    };

    let solutions  = solve(&board, &blocks, &opts);
    let elapsed_ms = t0.elapsed().as_secs_f64() * 1000.0;

    let boards: Vec<ApdBoard> = solutions.iter().map(|sol| board_to_c(&sol.board)).collect();
    let count = boards.len();
    let ptr = if count > 0 {
        let mut boxed = boards.into_boxed_slice();
        let p = boxed.as_mut_ptr();
        std::mem::forget(boxed);
        p
    } else {
        std::ptr::null_mut()
    };

    ApdSolveResult { solutions: ptr, count, elapsed_ms }
}

/// Request cancellation of an in-progress solve.
/// The solver checks this flag at each DFS call and returns early if set.
#[no_mangle]
pub extern "C" fn apd_cancel() {
    request_cancel();
}

#[no_mangle]
pub extern "C" fn apd_free_result(result: ApdSolveResult) {
    if !result.solutions.is_null() && result.count > 0 {
        unsafe {
            drop(Box::from_raw(std::slice::from_raw_parts_mut(
                result.solutions,
                result.count,
            )));
        }
    }
}

fn board_to_c(board: &Board) -> ApdBoard {
    let mut cells = [[0u8; 7]; 8];
    for i in 0..8usize {
        for j in 0..7usize {
            cells[i][j] = match board.board[i][j] {
                State::Empty     => 0,
                State::Fill(id)  => (id + 1) as u8,
                State::Wall('#') => 0xFF,
                State::Wall(_)   => 0xFE,
            };
        }
    }
    ApdBoard { cells }
}
