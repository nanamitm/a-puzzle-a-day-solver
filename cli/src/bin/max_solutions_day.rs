use std::env;

use a_puzzle_a_day_lib::{solve, Block, Board, Point, PuzzleType, SolverOptions};

const MONTH_NAMES: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAYS_IN_MONTH: [u32; 12] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

fn month_pos(month: u32) -> Point {
    let p = (month - 1) as usize;
    let x = usize::from(p > 5);
    let y = p - x * 6;
    Point::new(x as i32, y as i32)
}

fn day_pos(day: u32, typ: PuzzleType) -> Point {
    if typ == PuzzleType::Tetromino && day >= 29 {
        Point::new(6, (day - 25) as i32)
    } else {
        let x = (day - 1) / 7 + 2;
        let y = (day - 1) % 7;
        Point::new(x as i32, y as i32)
    }
}

fn parse_type(s: &str) -> Option<PuzzleType> {
    match s {
        "d" | "dragonfjord" => Some(PuzzleType::DragonFjord),
        "j" | "jarringwords" => Some(PuzzleType::JarringWords),
        "t" | "tetromino" => Some(PuzzleType::Tetromino),
        _ => None,
    }
}

fn main() {
    let mut typ = PuzzleType::DragonFjord;
    let mut allow_flip = false;
    let mut use_all_days = false;
    for arg in env::args().skip(1) {
        if arg == "--allow-flip" {
            allow_flip = true;
            continue;
        }
        if arg == "--all-days" {
            use_all_days = true;
            continue;
        }
        if let Some(v) = arg.strip_prefix("--type=") {
            typ = parse_type(v).expect("invalid type. use d|dragonfjord|j|jarringwords|t|tetromino");
            continue;
        }
        panic!("unknown arg: {}", arg);
    }

    let blocks = Block::get_blocks(typ);
    let opts = SolverOptions {
        allow_flip,
        one_solution: false,
        max_solutions: None,
    };

    let mut best = 0usize;
    let mut best_days: Vec<(u32, u32)> = vec![];

    for month in 1..=12u32 {
        let mpos = month_pos(month);
        let limit = if use_all_days {
            31
        } else {
            DAYS_IN_MONTH[(month - 1) as usize]
        };
        for day in 1..=limit {
            let board = Board::new_from_day_pos(mpos, day_pos(day, typ), None, typ);
            let cnt = solve(&board, &blocks, &opts).len();
            if cnt > best {
                best = cnt;
                best_days.clear();
                best_days.push((month, day));
            } else if cnt == best {
                best_days.push((month, day));
            }
        }
    }

    println!(
        "type={:?} allow_flip={} all_days={} max_solutions={}",
        typ, allow_flip, use_all_days, best
    );
    for (m, d) in best_days {
        println!("{} {}", MONTH_NAMES[(m - 1) as usize], d);
    }
}
