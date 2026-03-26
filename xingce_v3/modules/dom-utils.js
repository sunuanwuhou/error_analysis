(function () {
  function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add("open");
  }

  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove("open");
  }

  function bindModalBackdropClose() {
    document.querySelectorAll(".modal-mask").forEach(function (mask) {
      if (mask.dataset.modalBound === "1") return;
      mask.dataset.modalBound = "1";
      mask.addEventListener("click", function (event) {
        if (event.target === mask && mask.id !== "quizModal") {
          closeModal(mask.id);
        }
      });
    });
  }

  window.openModal = openModal;
  window.closeModal = closeModal;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindModalBackdropClose);
  } else {
    bindModalBackdropClose();
  }
})();
