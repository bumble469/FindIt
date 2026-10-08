const formTabs = document.querySelectorAll(".form-tab");
const formSteps = document.querySelectorAll(".form-step");
const nextButtons = document.querySelectorAll(".next-step");
const prevButtons = document.querySelectorAll(".prev-step");

function showFormStep(step) {
  formSteps.forEach((formStep) => {
    formStep.classList.toggle(
      "active",
      formStep.dataset.step === String(step)
    );
  });

  formTabs.forEach((tab) => {
    tab.classList.toggle(
      "active",
      tab.dataset.step === String(step)
    );
  });
}

nextButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showFormStep(button.dataset.next);
  });
});

prevButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showFormStep(button.dataset.prev);
  });
});

formTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    showFormStep(tab.dataset.step);
  });
});