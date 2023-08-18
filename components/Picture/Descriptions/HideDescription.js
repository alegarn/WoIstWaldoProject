import { useState } from "react";
import ShowHideDescription from "./ShowHideDescription";

export default function HideDescription({onSubmit, onCancel}) {

  const [descriptionText, setDescriptionText] = useState({});

  function inputChangeHandler(enteredValue) {
    setDescriptionText((currentInput) =>{
      return {
        ...currentInput,
        enteredValue
      }
    });
  };

  function submitHandler() {
    onSubmit(descriptionText.enteredValue);
  };

  return (
    <ShowHideDescription
      inputChangeHandler={inputChangeHandler}
      submitHandler={submitHandler}
      onCancel={onCancel} />
  );
};


