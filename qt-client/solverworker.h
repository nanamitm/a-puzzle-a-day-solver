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
    explicit SolverWorker(QObject* parent = nullptr) : QThread(parent) {}

    // Set before calling start()
    QDate date;
    int   puzzleType  = 0;  // 0=DragonFjord … 3=WeekDay
    int   weekdayIdx  = 0;  // 0=Sun … 6=Sat
    bool  allowFlip   = false;
    bool  findAll     = false;

    // Read after solved() signal
    SolveResult result;

    // Call from any thread to stop the solver early via FFI cancel flag
    void requestCancel() {
        apd_cancel();
        m_cancelled.store(true, std::memory_order_relaxed);
    }

signals:
    void solved();

protected:
    void run() override;

private:
    std::atomic<bool> m_cancelled{false};
};
