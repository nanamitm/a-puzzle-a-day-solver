#pragma once
#include <QThread>
#include <QDate>
#include <atomic>
#include <vector>
#include "solver_ffi.h"

struct SolveResult {
    std::vector<ApdBoard> solutions;
    double                elapsedMs = 0.0;
    bool                  cancelled = false;
};

class SolverWorker : public QThread {
    Q_OBJECT
public:
    explicit SolverWorker(QObject* parent = nullptr)
        : QThread(parent), m_cancelToken(apd_cancel_token_new()) {}
    ~SolverWorker() override { apd_cancel_token_free(m_cancelToken); }

    // Set before calling start()
    QDate date;
    int   puzzleType  = 0;  // 0=DragonFjord … 3=WeekDay
    int   weekdayIdx  = 0;  // 0=Sun … 6=Sat
    bool  allowFlip   = false;
    bool  findAll     = false;

    // Read after QThread::finished signal
    SolveResult result;

    // Call from any thread to stop this worker's solve early.
    // A cancel requested before run() starts is kept.
    void requestCancel() {
        m_cancelled.store(true, std::memory_order_relaxed);
        apd_cancel_token_cancel(m_cancelToken);
    }

protected:
    void run() override;

private:
    ApdCancelToken*   m_cancelToken;
    std::atomic<bool> m_cancelled{false};
};
