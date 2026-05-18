#include "boardwidget.h"
#include <QPainter>
#include <QPainterPath>

// Build a rect path where each corner is independently rounded or sharp.
static QPainterPath cellPath(int px, int py, int sz, int r,
                              bool tlR, bool trR, bool brR, bool blR)
{
    QPainterPath path;
    path.moveTo(px + (tlR ? r : 0), py);
    if (trR) { path.lineTo(px+sz-r, py);      path.arcTo(px+sz-2*r, py,        2*r, 2*r,  90, -90); }
    else       path.lineTo(px+sz,   py);
    if (brR) { path.lineTo(px+sz,   py+sz-r); path.arcTo(px+sz-2*r, py+sz-2*r, 2*r, 2*r,   0, -90); }
    else       path.lineTo(px+sz,   py+sz);
    if (blR) { path.lineTo(px+r,    py+sz);   path.arcTo(px,        py+sz-2*r, 2*r, 2*r, 270, -90); }
    else       path.lineTo(px,      py+sz);
    if (tlR) { path.lineTo(px,      py+r);    path.arcTo(px,        py,        2*r, 2*r, 180, -90); }
    else       path.lineTo(px,      py);
    path.closeSubpath();
    return path;
}

static const QColor PIECE_COLORS[] = {
    {},                      // 0  unused
    QColor( 70, 130, 180),   // 1  steel blue
    QColor(255, 160,  50),   // 2  orange
    QColor( 60, 179, 113),   // 3  sea green
    QColor(220,  80,  80),   // 4  red
    QColor(148, 103, 189),   // 5  purple
    QColor( 64, 200, 200),   // 6  cyan
    QColor(240, 200,  50),   // 7  yellow
    QColor(220, 100, 180),   // 8  magenta
    QColor(100, 200,  80),   // 9  lime
    QColor( 50, 180, 170),   // 10 teal
};
static constexpr int N_COLORS = int(sizeof(PIECE_COLORS) / sizeof(PIECE_COLORS[0]));

static const QColor DATE_BG (240, 235, 210);
static const QColor BORDER  ( 80,  80,  80);
static const QColor TEXT_COL( 30,  30,  30);

static const char* MONTH_ABBR[] = {
    "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
};
// Index 0=Sun, 1=Mon, ..., 6=Sat
static const char* WEEKDAY_ABBR[] = { "Sun","Mon","Tue","Wed","Thu","Fri","Sat" };

// ── BoardWidget ────────────────────────────────────────────────────────────

BoardWidget::BoardWidget(QWidget* parent) : QWidget(parent)
{
    setFixedSize(BOARD_COLS * CELL, BOARD_ROWS * CELL);
}

void BoardWidget::setPuzzleType(PuzzleType type)
{
    m_type = type;
    update();
}

void BoardWidget::setDate(QDate date, int weekdayIdx)
{
    m_date       = date;
    m_weekdayIdx = weekdayIdx;
    m_hasCells   = false;
    update();
}

void BoardWidget::setBoard(const uint8_t cells[BOARD_ROWS][BOARD_COLS])
{
    for (int r = 0; r < BOARD_ROWS; ++r)
        for (int c = 0; c < BOARD_COLS; ++c)
            m_cells[r][c] = cells[r][c];
    m_hasCells = true;
    update();
}

void BoardWidget::clearBoard()
{
    m_hasCells = false;
    update();
}

// ── Helpers ────────────────────────────────────────────────────────────────

bool BoardWidget::isPermWall(int r, int c) const
{
    // Common to all puzzle types
    if (r == 0 && c == 6) return true;
    if (r == 1 && c == 6) return true;

    switch (m_type) {
    case PuzzleType::DragonFjord:
    case PuzzleType::JarringWords:
        if (r == 6 && c >= 3) return true;
        if (r == 7)           return true;
        break;
    case PuzzleType::Tetromino:
        if (r == 6 && c <= 3) return true;
        if (r == 7)           return true;
        break;
    case PuzzleType::WeekDay:
        if (r == 7 && c <= 3) return true;
        break;
    }
    return false;
}

bool BoardWidget::isDateCell(int r, int c) const
{
    if (!m_date.isValid()) return false;

    int m = m_date.month() - 1;  // 0-based
    int d = m_date.day()   - 1;  // 0-based

    // Month cell
    if (r == m / 6 && c == m % 6) return true;

    // Day cell
    int dr, dc;
    if (m_type == PuzzleType::Tetromino && m_date.day() >= 29) {
        dr = 6; dc = m_date.day() - 25;
    } else {
        dr = d / 7 + 2; dc = d % 7;
    }
    if (r == dr && c == dc) return true;

    // Weekday cell (WeekDay type only)
    if (m_type == PuzzleType::WeekDay) {
        int p  = m_weekdayIdx;  // 0=Sun..6=Sat
        int wr = (p < 4) ? 6 : 7;
        int wc = (p < 4) ? p + 3 : p;
        if (r == wr && c == wc) return true;
    }
    return false;
}

int BoardWidget::cellGroup(int r, int c) const
{
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return -2;
    if (isPermWall(r, c)) return -2;

    if (m_hasCells) {
        uint8_t v = m_cells[r][c];
        if (v == 0xFF) return -2;
        if (v == 0xFE) return -1;
        if (v == 0)    return  0;
        return static_cast<int>(v);  // piece ID 1-N
    }

    // Empty-board mode: date cells are highlighted
    return isDateCell(r, c) ? -1 : 0;
}

QString BoardWidget::cellLabel(int r, int c) const
{
    // Months — rows 0-1, cols 0-5
    if (r <= 1 && c <= 5)
        return MONTH_ABBR[r * 6 + c];

    // Days — rows 2-6
    if (r >= 2 && r <= 6) {
        if (r <= 5) {
            // Rows 2-5: days 01-28, all puzzle types
            int day = (r - 2) * 7 + c + 1;
            return QString("%1").arg(day, 2, 10, QChar('0'));
        }
        // Row 6 depends on puzzle type
        if (m_type == PuzzleType::Tetromino) {
            // (6,0-3) are walls; (6,4)=29, (6,5)=30, (6,6)=31
            if (c >= 4) return QString("%1").arg(c - 4 + 29, 2, 10, QChar('0'));
        } else {
            // DragonFjord / JarringWords / WeekDay
            if (c <= 2) return QString("%1").arg(c + 29, 2, 10, QChar('0'));
            // c >= 3: weekday labels for WeekDay, walls for others (won't be called)
        }
    }

    // Weekday labels (WeekDay type only)
    if (m_type == PuzzleType::WeekDay) {
        // (6,3)=Sun (6,4)=Mon (6,5)=Tue (6,6)=Wed
        if (r == 6 && c >= 3 && c <= 6) return WEEKDAY_ABBR[c - 3];
        // (7,4)=Thu (7,5)=Fri (7,6)=Sat
        if (r == 7 && c >= 4 && c <= 6) return WEEKDAY_ABBR[c];
    }

    return "";
}

// ── paintEvent ─────────────────────────────────────────────────────────────

void BoardWidget::paintEvent(QPaintEvent*)
{
    QPainter p(this);
    p.setFont(QFont("Segoe UI", 9, QFont::Bold));
    constexpr int R = 10;

    // Pass 1: off-board cells (window background colour)
    p.setRenderHint(QPainter::Antialiasing, false);
    p.setPen(Qt::NoPen);
    p.setBrush(palette().color(QPalette::Window));
    for (int r = 0; r < BOARD_ROWS; ++r)
        for (int c = 0; c < BOARD_COLS; ++c)
            if (cellGroup(r, c) == -2)
                p.drawRect(c*CELL, r*CELL, CELL, CELL);

    // Pass 2: empty cells — rounded rect + label
    p.setRenderHint(QPainter::Antialiasing, true);
    p.setBrush(palette().color(QPalette::Mid));
    for (int r = 0; r < BOARD_ROWS; ++r) {
        for (int c = 0; c < BOARD_COLS; ++c) {
            if (cellGroup(r, c) != 0) continue;
            p.setPen(Qt::NoPen);
            p.drawRoundedRect(c*CELL+2, r*CELL+2, CELL-4, CELL-4, R, R);
            QString lbl = cellLabel(r, c);
            if (!lbl.isEmpty()) {
                p.setPen(palette().color(QPalette::Text));
                p.drawText(c*CELL, r*CELL, CELL, CELL, Qt::AlignCenter, lbl);
            }
        }
    }

    // Pass 3: piece cells with selective corner rounding
    for (int r = 0; r < BOARD_ROWS; ++r) {
        for (int c = 0; c < BOARD_COLS; ++c) {
            int g = cellGroup(r, c);
            if (g < 1) continue;

            int  px  = c*CELL, py = r*CELL;
            bool tO  = cellGroup(r-1, c) != g;
            bool rO  = cellGroup(r,   c+1) != g;
            bool bO  = cellGroup(r+1, c) != g;
            bool lO  = cellGroup(r,   c-1) != g;

            QColor col = (g < N_COLORS) ? PIECE_COLORS[g]
                                        : PIECE_COLORS[g % (N_COLORS - 1) + 1];
            auto path = cellPath(px, py, CELL, R, tO&&lO, tO&&rO, bO&&rO, bO&&lO);
            p.setPen(Qt::NoPen);
            p.setBrush(col);
            p.drawPath(path);
        }
    }

    // Pass 4: piece perimeter border lines
    p.setRenderHint(QPainter::Antialiasing, false);
    p.setPen(QPen(BORDER, 2));
    for (int r = 0; r < BOARD_ROWS; ++r) {
        for (int c = 0; c < BOARD_COLS; ++c) {
            int g = cellGroup(r, c);
            if (g < 1) continue;
            int px = c*CELL, py = r*CELL;
            if (cellGroup(r-1, c)   != g) p.drawLine(px,      py,       px+CELL, py);
            if (cellGroup(r+1, c)   != g) p.drawLine(px,      py+CELL,  px+CELL, py+CELL);
            if (cellGroup(r,   c-1) != g) p.drawLine(px,      py,       px,      py+CELL);
            if (cellGroup(r,   c+1) != g) p.drawLine(px+CELL, py,       px+CELL, py+CELL);
        }
    }

    // Pass 5: date marker cells — drawn on top of everything
    p.setRenderHint(QPainter::Antialiasing, true);
    for (int r = 0; r < BOARD_ROWS; ++r) {
        for (int c = 0; c < BOARD_COLS; ++c) {
            if (cellGroup(r, c) != -1) continue;
            int px = c*CELL, py = r*CELL;
            p.setPen(QPen(BORDER, 1.5));
            p.setBrush(DATE_BG);
            p.drawRoundedRect(px+2, py+2, CELL-4, CELL-4, 6, 6);
            QString lbl = cellLabel(r, c);
            if (!lbl.isEmpty()) {
                p.setPen(TEXT_COL);
                p.drawText(px, py, CELL, CELL, Qt::AlignCenter, lbl);
            }
        }
    }
}
