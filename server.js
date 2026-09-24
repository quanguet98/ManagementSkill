const fs = require("fs");
const path = require("path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const port = Number(process.env.PORT || 3000);
const databasePath = path.resolve(process.env.DB_PATH || "quiz.db");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new sqlite3.Database(databasePath);
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

db.exec(schema, (error) => {
  if (error) {
    console.error("Khong the khoi tao SQLite:", error);
    process.exit(1);
  }

  db.run(
    "ALTER TABLE quiz_attempts ADD COLUMN attempt_number INTEGER NOT NULL DEFAULT 1",
    (migrationError) => {
      if (migrationError && !migrationError.message.includes("duplicate column name")) {
        console.error("Khong the cap nhat SQLite:", migrationError);
        process.exit(1);
      }

      app.listen(port, () => {
        console.log(`Quiz server dang chay tai http://localhost:${port}`);
      });
    },
  );
});


app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function toAttempt(row) {
  return {
    id: row.id,
    submissionId: row.submission_id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    student: {
      name: row.student_name,
      className: row.student_class,
      email: row.student_email,
    },
    result: {
      score: row.score,
      totalQuestions: row.total_questions,
      percentage: row.percentage,
      status: row.status,
      passScore: row.pass_score,
      durationMinutes: row.duration_minutes,
      submittedAt: row.submitted_at,
    },
    attempt: row.attempt_number,
    attemptNumber: row.attempt_number,
    createdAt: row.created_at,
  };
}

function validatePayload(payload) {
  const { submissionId, quizId, student, result } = payload || {};

  if (!submissionId || !quizId || !student || !result) {
    return "Thieu thong tin bai lam";
  }

  if (!student.name || !student.className) {
    return "Thieu ho ten hoac lop";
  }

  if (!Number.isFinite(Number(result.score)) || !Number.isFinite(Number(result.totalQuestions))) {
    return "Diem hoac tong so cau khong hop le";
  }

  return null;
}

function saveAttempt(payload, res) {
  const validationError = validatePayload(payload);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const { submissionId, quizId, quizTitle, student, result, meta = {} } = payload;
  const studentName = student.name.trim();
  const studentClass = student.className.trim();

  db.serialize(() => {
    db.get(
      `SELECT id, attempt_number AS attemptNumber
       FROM quiz_attempts
       WHERE submission_id = ?`,
      [submissionId],
      (existingError, existing) => {
        if (existingError) {
          console.error("Loi kiem tra bai lam:", existingError);
          return res.status(500).json({ success: false, message: "Khong the luu ket qua" });
        }

        if (existing) {
          return res.json({
            success: true,
            message: "Ket qua da duoc luu truoc do",
            attempt: existing.attemptNumber,
            attemptNumber: existing.attemptNumber,
          });
        }

        db.get(
          `SELECT COUNT(*) AS count
           FROM quiz_attempts
           WHERE quiz_id = ? AND student_name = ? AND student_class = ?`,
          [quizId, studentName, studentClass],
          (countError, countRow) => {
            if (countError) {
              console.error("Loi dem lan lam bai:", countError);
              return res.status(500).json({ success: false, message: "Khong the luu ket qua" });
            }

            const attemptNumber = Number(countRow.count) + 1;
            db.run(
              `INSERT INTO quiz_attempts (
                submission_id, quiz_id, quiz_title, student_name, student_class,
                student_email, score, total_questions, percentage, status,
                pass_score, duration_minutes, submitted_at, page, user_agent,
                attempt_number
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                submissionId,
                quizId,
                quizTitle || "",
                studentName,
                studentClass,
                student.email || "",
                Number(result.score),
                Number(result.totalQuestions),
                Number(result.percentage) || 0,
                result.status || "",
                Number(result.passScore) || 0,
                Number(result.durationMinutes) || 0,
                result.submittedAt || new Date().toISOString(),
                meta.page || "",
                meta.userAgent || "",
                attemptNumber,
              ],
              (insertError) => {
                if (insertError) {
                  console.error("Loi luu ket qua:", insertError);
                  return res.status(500).json({ success: false, message: "Khong the luu ket qua vao SQLite" });
                }

                return res.status(201).json({
                  success: true,
                  message: "Da luu ket qua vao SQLite",
                  attempt: attemptNumber,
                  attemptNumber,
                });
              },
            );
          },
        );
      },
    );
  });
}

app.post("/api/quiz", (req, res) => saveAttempt(req.body, res));

// Backward-compatible endpoint for existing quiz.js clients.
app.get("/api/quiz", (req, res) => {
  if (req.query.action !== "submit" || !req.query.data) {
    return res.status(400).json({ success: false, message: "Yeu cau khong hop le" });
  }

  try {
    return saveAttempt(JSON.parse(req.query.data), res);
  } catch (_) {
    return res.status(400).json({ success: false, message: "Du lieu data khong phai JSON hop le" });
  }
});

app.get("/api/results", (_req, res) => {
  db.all(
    `SELECT * FROM quiz_attempts
     ORDER BY datetime(submitted_at) DESC, id DESC`,
    (error, rows) => {
      if (error) {
        console.error("Loi tai danh sach ket qua:", error);
        return res.status(500).json({ success: false, message: "Khong the tai ket qua" });
      }

      return res.json({ success: true, data: rows.map(toAttempt) });
    },
  );
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, databasePath });
});