import { useState } from "react";
import ShowDescription from "./ShowDescription";

export default function Description({onSubmit, onCancel}) {

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
    <ShowDescription
      inputChangeHandler={inputChangeHandler}
      submitHandler={submitHandler}
      onCancel={onCancel} />
  );
};


