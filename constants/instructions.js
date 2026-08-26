// Screen-name keys are stable identifiers consumed by TutorialOverlay
// (INSTRUCTIONS.Tutorial[`${screen}`] / [`${screen}ModalBtn`]) — do NOT rename.
// Values are i18n keys resolved at render time (t(value)).
export const INSTRUCTIONS = {
  /* tutorial */
  Tutorial: {
    HomeScreen: "tutorial.homeScreen",
    HomeScreenModalBtn: {
      hide : "tutorial.homeHideBtn",
      guess: "tutorial.homeGuessBtn",
      finish: "tutorial.homeFinishBtn"
    },
    HidingPathScreen: "tutorial.hidingPath",
    HidingPathScreenModalBtn: "tutorial.hidingPathBtn",
    HideScreen: "tutorial.hideScreen",
    HideScreenModalBtn: "tutorial.hideBtn",
    SetInstructionScreen: "tutorial.setInstruction",
    SetInstructionScreenModalBtn: "tutorial.setInstructionBtn",
    GuessPathScreen: "tutorial.guessPath",
    GuessPathScreenModalBtn: "tutorial.guessPathBtn",
    GuessScreen: "tutorial.guessScreen",
    GuessScreenModalBtn: "tutorial.guessBtn",
    ShowSuccess: "tutorial.showSuccess",
    ShowSuccessModalBtn: "tutorial.showSuccessBtn",
    ShowFailure: "tutorial.showFailure",
    ShowFailureModalBtn: "tutorial.showFailureBtn",
  },
};
