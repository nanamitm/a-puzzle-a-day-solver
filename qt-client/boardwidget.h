#pragma once
#include <QWidget>
#include <QDate>
#include <cstdint>

constexpr int BOARD_ROWS = 8;
constexpr int BOARD_COLS = 7;

enum class PuzzleType { DragonFjord = 0, JarringWords = 1, Tetromino = 2, WeekDay = 3 };

class BoardWidget : public QWidget {
    Q_OBJECT
public:
    explicit BoardWidget(QWidget* parent = nullptr);

    void setPuzzleType(PuzzleType type);

    // weekdayIdx: 0=Sun, 1=Mon, ..., 6=Sat — only relevant when type==WeekDay
    void setDate(QDate date, int weekdayIdx = 0);

    // Show a solution (cells from FFI)
    void setBoard(const uint8_t cells[BOARD_ROWS][BOARD_COLS]);

    // Revert to empty-board (label) view
    void clearBoard();

protected:
    void paintEvent(QPaintEvent*) override;

private:
    static constexpr int CELL = 64;

    PuzzleType m_type       = PuzzleType::DragonFjord;
    QDate      m_date;
    int        m_weekdayIdx = 0;
    bool       m_hasCells   = false;
    uint8_t    m_cells[BOARD_ROWS][BOARD_COLS]{};

    // -2=off-board  -1=date marker  0=empty  1-N=piece ID
    int     cellGroup(int r, int c) const;
    QString cellLabel(int r, int c) const;
    bool    isPermWall(int r, int c) const;
    bool    isDateCell(int r, int c) const;
};
