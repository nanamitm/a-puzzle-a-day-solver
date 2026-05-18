#pragma once
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>

// Board cell values:
//   0    = empty
//   1-N  = piece ID (1-indexed)
//   0xFE = date / weekday marker cell
//   0xFF = permanent wall (off-board)
typedef struct {
    uint8_t cells[8][7];  // [row][col]
} ApdBoard;

typedef struct {
    ApdBoard* solutions;
    size_t    count;
    double    elapsed_ms;
} ApdSolveResult;

#ifdef __cplusplus
extern "C" {
#endif

// puzzle_type: 0=DragonFjord, 1=JarringWords, 2=Tetromino, 3=WeekDay
// weekday:     0=Sun, 1=Mon, ..., 6=Sat  (only used when puzzle_type == 3)
ApdSolveResult apd_solve(
    uint32_t month,
    uint32_t day,
    uint32_t weekday,
    uint32_t puzzle_type,
    bool     allow_flip,
    bool     find_all
);

// Request early termination of an in-progress solve.
void apd_cancel();

void apd_free_result(ApdSolveResult result);

#ifdef __cplusplus
}
#endif
