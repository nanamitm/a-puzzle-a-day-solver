use a_puzzle_a_day_lib::{Block, Board, Point, PuzzleType, SolverOptions, State, solve_with_cancel};
use std::sync::atomic::{AtomicBool, Ordering};
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

/// Opaque cancellation token for one solve. Create it before starting the
/// solve so that a cancel requested at any time is never lost.
pub struct ApdCancelToken {
    flag: AtomicBool,
}

/// Create a cancellation token. Free it with apd_cancel_token_free.
#[no_mangle]
pub extern "C" fn apd_cancel_token_new() -> *mut ApdCancelToken {
    Box::into_raw(Box::new(ApdCancelToken { flag: AtomicBool::new(false) }))
}

/// Request early termination of the solve using `token`. Safe to call from
/// any thread, before or during the solve.
///
/// # Safety
/// `token` must be null or a live pointer from apd_cancel_token_new.
#[no_mangle]
pub unsafe extern "C" fn apd_cancel_token_cancel(token: *const ApdCancelToken) {
    if let Some(token) = unsafe { token.as_ref() } {
        token.flag.store(true, Ordering::Relaxed);
    }
}

/// # Safety
/// `token` must be null or a pointer from apd_cancel_token_new that is not
/// used by a running solve and has not been freed yet.
#[no_mangle]
pub unsafe extern "C" fn apd_cancel_token_free(token: *mut ApdCancelToken) {
    if !token.is_null() {
        drop(unsafe { Box::from_raw(token) });
    }
}

/// puzzle_type: 0=DragonFjord, 1=JarringWords, 2=Tetromino, 3=WeekDay
/// weekday:     0=Sun, 1=Mon, ..., 6=Sat  (only used when puzzle_type == 3)
/// cancel:     token from apd_cancel_token_new, or null for an uncancellable solve
///
/// Invalid inputs return an empty result. weekday is ignored for other puzzle types.
/// Caller must free the returned result with apd_free_result.
///
/// # Safety
/// `cancel` must be null or a live pointer from apd_cancel_token_new that
/// stays valid until this call returns.
#[no_mangle]
pub unsafe extern "C" fn apd_solve(
    month:       u32,
    day:         u32,
    weekday:     u32,
    puzzle_type: u32,
    allow_flip:  bool,
    find_all:    bool,
    cancel:      *const ApdCancelToken,
) -> ApdSolveResult {
    let t0 = Instant::now();

    if !(1..=12).contains(&month)
        || !(1..=31).contains(&day)
        || puzzle_type > 3
        || (puzzle_type == 3 && weekday > 6)
    {
        return ApdSolveResult {
            solutions: std::ptr::null_mut(),
            count: 0,
            elapsed_ms: t0.elapsed().as_secs_f64() * 1000.0,
        };
    }

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

    let not_cancelled = AtomicBool::new(false);
    let cancel = unsafe { cancel.as_ref() }.map_or(&not_cancelled, |t| &t.flag);
    let solutions  = solve_with_cancel(&board, &blocks, &opts, cancel);
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

#[no_mangle]
pub extern "C" fn apd_free_result(result: ApdSolveResult) {
    if !result.solutions.is_null() && result.count > 0 {
        unsafe {
            drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(
                result.solutions,
                result.count,
            )));
        }
    }
}

fn board_to_c(board: &Board) -> ApdBoard {
    let mut cells = [[0u8; 7]; 8];
    for (i, row) in cells.iter_mut().enumerate() {
        for (j, cell) in row.iter_mut().enumerate() {
            *cell = match board.board[i][j] {
                State::Empty     => 0,
                State::Fill(id)  => (id + 1) as u8,
                State::Wall('#') => 0xFF,
                State::Wall(_)   => 0xFE,
            };
        }
    }
    ApdBoard { cells }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_inputs_return_empty_results() {
        for (month, day, weekday, typ) in [
            (0, 1, 0, 0), (13, 1, 0, 0), (1, 0, 0, 0), (1, 32, 0, 0),
            (1, 1, 7, 3), (1, 1, 0, 4), (u32::MAX, 1, 0, 0),
        ] {
            let result = unsafe {
                apd_solve(month, day, weekday, typ, false, false, std::ptr::null())
            };
            assert!(result.solutions.is_null());
            assert_eq!(result.count, 0);
            apd_free_result(result);
        }
    }

    #[test]
    fn cancel_before_solve_returns_no_solutions() {
        let token = apd_cancel_token_new();
        unsafe {
            apd_cancel_token_cancel(token);
            let result = apd_solve(1, 1, 0, 0, false, true, token);
            assert_eq!(result.count, 0);
            apd_free_result(result);
            apd_cancel_token_free(token);
        }
    }
}
