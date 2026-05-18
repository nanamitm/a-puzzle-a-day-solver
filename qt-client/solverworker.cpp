#include "solverworker.h"

void SolverWorker::run()
{
    m_cancelled.store(false, std::memory_order_relaxed);

    ApdSolveResult r = apd_solve(
        static_cast<uint32_t>(date.month()),
        static_cast<uint32_t>(date.day()),
        static_cast<uint32_t>(weekdayIdx),
        static_cast<uint32_t>(puzzleType),
        allowFlip,
        findAll
    );

    result.elapsedMs = r.elapsed_ms;
    result.cancelled = m_cancelled.load(std::memory_order_relaxed);
    result.solutions.clear();

    // Keep solutions found so far even if cancelled mid-search
    for (size_t i = 0; i < r.count; ++i)
        result.solutions.push_back(r.solutions[i]);

    apd_free_result(r);
    emit solved();
}
