const timeButton = document.getElementById('time-button');
const timeDisplay = document.getElementById('time-display');

timeButton.addEventListener('click', () => {
  const currentTime = new Date().toLocaleTimeString();
  timeDisplay.textContent = `The current time is: ${currentTime}`;
});
const downloadBtn = document.querySelector('.download-btn');
  downloadBtn.addEventListener('click', () => {
  console.log('Download initiated');
});
