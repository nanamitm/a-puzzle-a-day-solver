#pragma once
#include <QMainWindow>
#include <QDateEdit>
#include <QPushButton>
#include <QCheckBox>
#include <QComboBox>
#include <QLabel>
#include <QTimer>
#include <QElapsedTimer>
#include <QAction>
#include <QVector>
#include "boardwidget.h"
#include "solverworker.h"

class SolveOverlay;

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget* parent = nullptr);
    ~MainWindow() override;

private slots:
    void onTriggerSolve();
    void onSolved();
    void onPrev();
    void onNext();
    void onSlideshowTick();
    void onMidnight();
    void onPuzzleTypeChanged();
    void setAlwaysOnTop(bool on);

private:
    void buildUi();
    void scheduleSolve();
    void scheduleMidnight();
    void showSolution(int idx);
    void updateTodayMarker();
    void updateBoardDate();   // sync board widget with current date + weekday + type
    int  currentWeekdayIdx() const;  // derived from date picker (0=Sun..6=Sat)

    // ── Widgets ──────────────────────────────────────────────────────────
    QDateEdit*   m_dateEdit      = nullptr;
    QPushButton* m_todayBtn      = nullptr;
    QComboBox*   m_typeCombo     = nullptr;
    QCheckBox*   m_findAllChk    = nullptr;
    QCheckBox*   m_flipChk       = nullptr;
    QAction*     m_autoAct       = nullptr;
    QAction*     m_slideshowAct  = nullptr;
    QAction*     m_alwaysOnTopAct = nullptr;
    BoardWidget* m_board         = nullptr;
    QPushButton* m_prevBtn       = nullptr;
    QPushButton* m_nextBtn       = nullptr;
    QLabel*      m_solLabel      = nullptr;
    QLabel*      m_statusLbl     = nullptr;

    // ── State ─────────────────────────────────────────────────────────────
    QTimer*            m_debounce    = nullptr;
    QTimer*            m_tickTimer   = nullptr;
    QTimer*            m_midnight    = nullptr;
    QTimer*            m_slideshow   = nullptr;
    bool               m_savedFindAll = false;
    bool               m_savedAutoMid = false;
    QElapsedTimer      m_elapsed;
    SolverWorker*      m_worker      = nullptr;
    SolveOverlay*      m_overlay     = nullptr;
    QVector<ApdBoard>  m_solutions;
    int                m_idx         = 0;
};
