(function () {
  var ring = document.getElementById('timer-ring');
  var text = document.getElementById('timer-text');
  if (!ring || !text) return;

  var expiresAt = new Date(ring.dataset.expiresAt).getTime();
  var totalMs = Number(ring.dataset.lockMinutes) * 60 * 1000;

  function tick() {
    var remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      window.location.reload();
      return;
    }

    var remainingSec = Math.ceil(remainingMs / 1000);
    var minutes = Math.floor(remainingSec / 60);
    var seconds = remainingSec % 60;
    text.textContent = minutes + ':' + String(seconds).padStart(2, '0');

    var pct = Math.max(0, Math.round((remainingMs / totalMs) * 100));
    ring.style.setProperty('--pct', pct);
    ring.classList.toggle('warning', remainingSec <= 60);
  }

  tick();
  setInterval(tick, 1000);
})();
