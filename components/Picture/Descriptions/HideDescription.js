import { useState } from "react";
import ShowHideDescription from "./ShowHideDescription";

export default function HideDescription({
  onSubmit,
  onCancel,
  language,
  onLanguageChange,
  languageError,
  categories,
  categoriesError,
  onRetryCategories,
  selectedCategory,
  onCategorySelect,
}) {

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
      onCancel={onCancel}
      language={language}
      onLanguageChange={onLanguageChange}
      languageError={languageError}
      categories={categories}
      categoriesError={categoriesError}
      onRetryCategories={onRetryCategories}
      selectedCategory={selectedCategory}
      onCategorySelect={onCategorySelect} />
  );
};


