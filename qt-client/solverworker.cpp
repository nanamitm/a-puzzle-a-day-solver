#include "solverworker.h"

void SolverWorker::run()
{
    ApdSolveResult r = apd_solve(
        static_cast<uint32_t>(date.month()),
        static_cast<uint32_t>(date.day()),
        static_cast<uint32_t>(weekdayIdx),
        static_cast<uint32_t>(puzzleType),
        allowFlip,
        findAll,
        m_cancelToken
    );

    result.elapsedMs = r.elapsed_ms;
    result.cancelled = m_cancelled.load(std::memory_order_relaxed);
    result.solutions.clear();

    // Keep solutions found so far even if cancelled mid-search
    for (size_t i = 0; i < r.count; ++i)
        result.solutions.push_back(r.solutions[i]);

    apd_free_result(r);
}
