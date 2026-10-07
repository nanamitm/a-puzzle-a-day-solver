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

// Opaque per-solve cancellation token (owned by the Rust library).
typedef struct ApdCancelToken ApdCancelToken;

#ifdef __cplusplus
extern "C" {
#endif

// Create a token before starting a solve; free it with apd_cancel_token_free
// once the solve using it has returned.
ApdCancelToken* apd_cancel_token_new(void);

// Request early termination of the solve using token. Safe from any thread,
// before or during the solve.
void apd_cancel_token_cancel(const ApdCancelToken* token);

void apd_cancel_token_free(ApdCancelToken* token);

// puzzle_type: 0=DragonFjord, 1=JarringWords, 2=Tetromino, 3=WeekDay
// weekday:     0=Sun, 1=Mon, ..., 6=Sat  (only used when puzzle_type == 3)
// cancel:      token from apd_cancel_token_new, or NULL
ApdSolveResult apd_solve(
    uint32_t month,
    uint32_t day,
    uint32_t weekday,
    uint32_t puzzle_type,
    bool     allow_flip,
    bool     find_all,
    const ApdCancelToken* cancel
);

void apd_free_result(ApdSolveResult result);

#ifdef __cplusplus
}
#endif
