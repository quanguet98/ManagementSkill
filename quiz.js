(function () {
  "use strict";

  const LETTERS = ["A", "B", "C", "D"];
  const $ = (id) => document.getElementById(id);
  const ALL = QUESTIONS;
  const SET = window.QUIZ_PICK ? window.QUIZ_PICK.map((i) => ALL[i]) : ALL;
  const total = SET.length;
  const PASS = window.QUIZ_PASS || CONFIG.passScore || Math.ceil(total * 0.6);

  let student = null;
  let answers = new Array(total).fill(null);
  let startedAt = null;
  let timerId = null;
  let result = null;
  let submissionId = null;

  $("title").textContent = CONFIG.quizTitle;
  $("subtitle").textContent = window.QUIZ_SUBTITLE || CONFIG.quizSubtitle;
  $("totalNum").textContent = "/" + total;
  $("rules").textContent =
    "Bài gồm " +
    total +
    " câu, mỗi câu đúng 1 điểm. " +
    (CONFIG.timeLimitMinutes > 0
      ? "Thời gian làm bài " + CONFIG.timeLimitMinutes + " phút. "
      : "Không giới hạn thời gian. ") +
    "Điểm đạt: " +
    PASS +
    "/" +
    total +
    ".";

  if (CONFIG.requireEmail) {
    $("emailOpt").textContent = "(bắt buộc)";
    $("email").required = true;
  }

  $("infoForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const name = $("name").value.trim();
    const clazz = $("clazz").value.trim();
    const email = $("email").value.trim();
    const err = $("infoErr");
    err.style.display = "none";

    if (!name || !clazz) {
      err.textContent = "Vui lòng nhập họ tên và lớp.";
      err.style.display = "block";
      return;
    }
    if (
      (CONFIG.requireEmail && !email) ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      err.textContent = "Email chưa hợp lệ.";
      err.style.display = "block";
      return;
    }
    student = { name, clazz, email };
    startQuiz();
  });

  function startQuiz() {
    $("screen-info").classList.add("hidden");
    $("screen-quiz").classList.remove("hidden");
    $("whoami").textContent = student.name + " • " + student.clazz;
    renderQuestions();
    updateProgress();
    startedAt = new Date();
    submissionId = createSubmissionId();
    if (CONFIG.timeLimitMinutes > 0) startTimer();
    window.scrollTo(0, 0);
  }

  function renderQuestions() {
    const box = $("questions");
    box.innerHTML = "";
    SET.forEach(function (q, i) {
      const el = document.createElement("div");
      el.className = "q";
      el.id = "q" + i;
      const opts = q.o
        .map(function (text, j) {
          return (
            '<label class="opt" data-q="' +
            i +
            '" data-o="' +
            j +
            '">' +
            '<input type="radio" name="q' +
            i +
            '" value="' +
            j +
            '">' +
            "<span><b>" +
            LETTERS[j] +
            ".</b> " +
            esc(text) +
            "</span></label>"
          );
        })
        .join("");
      el.innerHTML =
        '<div class="qhead"><span class="badge">Câu ' +
        (i + 1) +
        "/" +
        total +
        "</span>" +
        '<span class="badge">' +
        esc(q.g) +
        "</span></div>" +
        '<div class="qtext">' +
        esc(q.q) +
        "</div>" +
        opts;
      box.appendChild(el);
    });
  }

  $("questions").addEventListener("change", function (ev) {
    const lab = ev.target.closest(".opt");
    if (!lab) return;
    const qi = Number(lab.dataset.q);
    answers[qi] = Number(lab.dataset.o);
    const card = $("q" + qi);
    card.classList.remove("unanswered");
    card.querySelectorAll(".opt").forEach((o) => o.classList.remove("sel"));
    lab.classList.add("sel");
    updateProgress();
  });

  function updateProgress() {
    const done = answers.filter((a) => a !== null).length;
    $("progressText").textContent = done + "/" + total + " câu đã trả lời";
    $("progressBar").style.width = (done / total) * 100 + "%";
  }

  function startTimer() {
    let left = CONFIG.timeLimitMinutes * 60;
    timerId = setInterval(function () {
      left--;
      const m = String(Math.floor(left / 60)).padStart(2, "0");
      const s = String(left % 60).padStart(2, "0");
      $("timer").textContent = "⏱ " + m + ":" + s;
      if (left <= 0) {
        clearInterval(timerId);
        finish(true);
      }
    }, 1000);
  }

  $("submitBtn").addEventListener("click", function () {
    finish(false);
  });

  function finish(auto) {
    const missing = [];
    answers.forEach(function (answer, i) {
      if (answer === null) missing.push(i);
    });
    if (!auto && missing.length) {
      missing.forEach((i) => $("q" + i).classList.add("unanswered"));
      const err = $("quizErr");
      err.textContent =
        "Bạn còn " +
        missing.length +
        " câu chưa trả lời (đã đánh dấu màu vàng).";
      err.style.display = "block";
      $("q" + missing[0]).scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    if (timerId) clearInterval(timerId);
    showResult();
  }

  function showResult() {
    let score = 0;
    const byGroup = {};
    SET.forEach(function (q, i) {
      const ok = answers[i] === q.a;
      if (ok) score++;
      if (!byGroup[q.g]) byGroup[q.g] = { ok: 0, n: 0 };
      byGroup[q.g].n++;
      if (ok) byGroup[q.g].ok++;
    });
    const minutes = Math.max(
      1,
      Math.round((Date.now() - startedAt.getTime()) / 60000),
    );
    const pct = Math.round((score / total) * 100);
    result = {
      score,
      total,
      percentage: pct,
      passed: score >= PASS,
      passScore: PASS,
      minutes,
      submittedAt: new Date().toISOString(),
    };

    $("screen-quiz").classList.add("hidden");
    $("screen-result").classList.remove("hidden");
    $("scoreNum").textContent = score;
    $("resultLine").textContent =
      student.name +
      " • " +
      student.clazz +
      " • " +
      pct +
      "% • " +
      (result.passed ? "ĐẠT" : "CHƯA ĐẠT — nên ôn lại");
    $("breakdown").innerHTML = Object.keys(byGroup)
      .map(function (group) {
        const item = byGroup[group];
        return (
          "<tr><td>" +
          esc(group) +
          "</td><td>" +
          item.ok +
          "/" +
          item.n +
          "</td><td>" +
          Math.round((item.ok / item.n) * 100) +
          "%</td></tr>"
        );
      })
      .join("");
    if (CONFIG.showReview) renderReview();
    else $("reviewCard").classList.add("hidden");
    window.scrollTo(0, 0);
    saveViaApi();
  }

  function renderReview() {
    $("review").innerHTML = SET.map(function (q, i) {
      const opts = q.o
        .map(function (text, j) {
          let cls = "opt";
          if (j === q.a) cls += " correct";
          else if (j === answers[i]) cls += " wrong";
          return (
            '<div class="' +
            cls +
            '"><span><b>' +
            LETTERS[j] +
            ".</b> " +
            esc(text) +
            "</span></div>"
          );
        })
        .join("");
      const ok = answers[i] === q.a;
      return (
        '<div class="q"><div class="qhead"><span class="badge">Câu ' +
        (i + 1) +
        "</span>" +
        '<span class="badge">' +
        esc(q.g) +
        "</span>" +
        '<span class="badge ' +
        (ok ? "right" : "wrongb") +
        '">' +
        (ok ? "Đúng" : "Sai") +
        "</span></div>" +
        '<div class="qtext">' +
        esc(q.q) +
        "</div>" +
        opts +
        '<div class="exp"><b>Giải thích:</b> ' +
        esc(q.e) +
        "</div></div>"
      );
    }).join("");
  }

  $("retryBtn").addEventListener("click", function () {
    answers = new Array(total).fill(null);
    result = null;
    submissionId = null;
    $("quizErr").style.display = "none";
    $("screen-result").classList.add("hidden");
    startQuiz();
  });

  function buildPayload() {
    return {
      submissionId,
      quizId: CONFIG.quizId || location.pathname.split("/").pop() || "quiz",
      quizTitle:
        window.QUIZ_SUBTITLE || CONFIG.quizSubtitle || CONFIG.quizTitle,
      student: {
        name: student.name,
        className: student.clazz,
        email: student.email || "",
      },
      result: {
        score: result.score,
        totalQuestions: result.total,
        percentage: result.percentage,
        status: result.passed ? "Đạt" : "Chưa đạt",
        passScore: result.passScore,
        durationMinutes: result.minutes,
        submittedAt: result.submittedAt,
      },
      meta: { page: location.href, userAgent: navigator.userAgent },
    };
  }

  async function saveViaApi() {
    if (!CONFIG.apiUrl || CONFIG.apiUrl.indexOf("PASTE_") === 0) {
      status(
        "warn",
        "Chưa cấu hình API lưu kết quả. Vui lòng tải file kết quả bên dưới.",
      );
      return;
    }
    status("warn", "Đang lưu kết quả lên hệ thống…");
    try {
      const data = await postWithRetry(buildPayload());
      const attempt = data.attempt || data.attemptNumber;
      status(
        "ok",
        "Đã lưu kết quả thành công." +
          (attempt ? " Đây là lần làm thứ " + attempt + " của bạn." : ""),
      );
    } catch (error) {
      console.error("Không lưu được kết quả:", error);
      status(
        "err",
        "Không lưu được kết quả (" +
          (error.message || String(error)) +
          "). Vui lòng tải file kết quả bên dưới.",
      );
    }
  }

  async function postWithRetry(payload) {
    const maxAttempts = Number(CONFIG.apiRetryCount || 3);
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await postOnce(payload);
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts || !error.retryable) throw error;
        await sleep(500 * attempt + Math.random() * 500);
      }
    }
    throw lastError;
  }

  async function postOnce(payload) {
    const controller = new AbortController();

    const timeoutId = setTimeout(
      () => controller.abort(),
      Number(CONFIG.apiTimeoutMs || 15000),
    );

    try {
      const url =
        CONFIG.apiUrl +
        "?action=submit&data=" +
        encodeURIComponent(JSON.stringify(payload));

      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      const bodyText = await response.text();

      let data = {};

      if (bodyText) {
        try {
          data = JSON.parse(bodyText);
        } catch (_) {
          data = {
            success: false,
            message: "API trả về dữ liệu không hợp lệ",
          };
        }
      }

      if (!response.ok || data.success === false) {
        const error = new Error(data.message || "HTTP " + response.status);

        error.retryable = false;

        throw error;
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("API phản hồi quá thời gian");

        timeoutError.retryable = true;

        throw timeoutError;
      }

      if (typeof error.retryable === "undefined") {
        error.retryable = false;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function status(kind, message) {
    const el = $("saveStatus");
    el.className = "status " + kind;
    el.textContent = message;
  }
  function createSubmissionId() {
    return window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function esc(value) {
    return String(value).replace(
      /[&<>"]/g,
      (char) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
    );
  }
  function slug(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .replace(/[^a-zA-Z0-9]+/g, "_");
  }
  function fmtTime(date) {
    const p = (n) => String(n).padStart(2, "0");
    return (
      p(date.getDate()) +
      "/" +
      p(date.getMonth() + 1) +
      "/" +
      date.getFullYear() +
      " " +
      p(date.getHours()) +
      ":" +
      p(date.getMinutes())
    );
  }
  window.addEventListener("beforeunload", function (event) {
    if (startedAt && !result) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
})();
