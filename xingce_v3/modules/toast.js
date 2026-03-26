(function () {
  function showToast(message, type) {
    var stack = document.getElementById("toastStack");
    if (!stack) return;
    var toast = document.createElement("div");
    toast.className = "toast " + (type || "success");
    toast.textContent = message;
    stack.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add("show");
    });
    setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () {
        toast.remove();
      }, 220);
    }, 2200);
  }

  window.showToast = showToast;
})();
