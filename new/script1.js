const questions = {
  "q1": "C",
  // Add more questions here
};

let timer;
let endTime = Date.now() + 900000; // 15 minutes

document.getElementById("startButton").addEventListener("click", startTimer);

function startTimer() {
  document.getElementById("startButton").style.display = "none"; // Hide start button
  document.getElementById("submitButton").style.display = "inline-block"; // Show submit button
  timer = setInterval(updateTimer, 1000);
}

function updateTimer() {
  const now = Date.now();
  const remainingTime = endTime - now;
  if (remainingTime <= 0) {
    clearInterval(timer);
    showReport();
  } else {
    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);
    document.getElementById("timer").innerText = `Time Remaining: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
}

function showReport() {
  clearInterval(timer);
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  for (const q in questions) {
    const selectedOption = document.querySelector(`input[name=${q}]:checked`);
    if (selectedOption) {
      if (selectedOption.value === questions[q]) {
        correct++;
      } else {
        wrong++;
      }
    } else {
      unanswered++;
    }
  }
  const report = `Correct: ${correct}, Wrong: ${wrong}, Unanswered: ${unanswered}`;
  document.getElementById("report").innerText = report;
}
