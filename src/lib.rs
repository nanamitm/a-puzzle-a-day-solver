use a_puzzle_a_day_lib::*;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen]
/// month: 1~12, day: 1~31
pub fn find_solution(
    month: i32,
    day: i32,
    week: i32,
    puzzle_type: i32,
    allow_flip: bool,
) -> String {
    let m = {
        let x = i32::from(month > 6);
        let y = (month - 1) - x * 6;
        Point::new(x, y)
    };
    let puzzle_type = match puzzle_type {
        0 => PuzzleType::DragonFjord,
        1 => PuzzleType::JarringWords,
        2 => PuzzleType::Tetromino,
        3 => PuzzleType::WeekDay,
        _x => panic!("{}", "invalid puzzle_type: {x}"),
    };
    let d = {
        if puzzle_type == PuzzleType::Tetromino && day >= 29 {
            Point::new(6, day - 25)
        } else {
            let x = (day - 1) / 7 + 2;
            let y = (day - 1) % 7;
            Point::new(x, y)
        }
    };
    let w = if puzzle_type == PuzzleType::WeekDay {
        let x = if week < 4 { 6 } else { 7 };
        let y = if week < 4 { week + 3 } else { week };
        Some(Point::new(x, y))
    } else {
        None
    };

    let board = Board::new_from_day_pos(m, d, w, puzzle_type);
    let blocks = Block::get_blocks(puzzle_type);
    let opts = SolverOptions {
        allow_flip,
        one_solution: true,
        max_solutions: Some(1),
    };

    let sols = solve(&board, &blocks, &opts)
        .into_iter()
        .map(|s| s.board)
        .collect::<Vec<_>>();

    if sols.is_empty() {
        "".to_string()
    } else {
        sols[0].to_string()
    }
}

fn json_escape(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            _ => out.push(c),
        }
    }
    out
}

#[wasm_bindgen]
/// month: 1~12, day: 1~31
pub fn find_solutions(
    month: i32,
    day: i32,
    week: i32,
    puzzle_type: i32,
    allow_flip: bool,
    max_solutions: usize,
) -> String {
    let m = {
        let x = i32::from(month > 6);
        let y = (month - 1) - x * 6;
        Point::new(x, y)
    };
    let puzzle_type = match puzzle_type {
        0 => PuzzleType::DragonFjord,
        1 => PuzzleType::JarringWords,
        2 => PuzzleType::Tetromino,
        3 => PuzzleType::WeekDay,
        _x => panic!("{}", "invalid puzzle_type: {x}"),
    };
    let d = {
        if puzzle_type == PuzzleType::Tetromino && day >= 29 {
            // Tetromino type uses the bottom-right 3 cells for 29-31.
            Point::new(6, day - 25)
        } else {
            let x = (day - 1) / 7 + 2;
            let y = (day - 1) % 7;
            Point::new(x, y)
        }
    };
    let w = if puzzle_type == PuzzleType::WeekDay {
        let x = if week < 4 { 6 } else { 7 };
        let y = if week < 4 { week + 3 } else { week };
        Some(Point::new(x, y))
    } else {
        None
    };

    let board = Board::new_from_day_pos(m, d, w, puzzle_type);
    let blocks = Block::get_blocks(puzzle_type);
    let opts = SolverOptions {
        allow_flip,
        one_solution: false,
        max_solutions: Some(max_solutions),
    };

    let sols = solve(&board, &blocks, &opts)
        .into_iter()
        .map(|s| s.board)
        .collect::<Vec<_>>();
    let json_items = sols
        .iter()
        .map(|b| format!("\"{}\"", json_escape(&b.to_string())))
        .collect::<Vec<_>>();
    format!("[{}]", json_items.join(","))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_solution_compatible() {
        let s = find_solution(1, 1, 0, 0, false);
        assert!(!s.is_empty());
    }

    #[test]
    fn test_find_solutions_json_and_limit() {
        let json = find_solutions(1, 1, 0, 0, false, 1);
        let sols = parse_json_string_array(&json);
        assert_eq!(sols.len(), 1);
        assert!(!sols[0].is_empty());
    }

    #[test]
    fn test_find_solutions_empty() {
        let json = find_solutions(12, 29, 0, 0, false, 50);
        let sols = parse_json_string_array(&json);
        assert!(sols.is_empty());
    }
}
