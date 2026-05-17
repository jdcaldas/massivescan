import React, { useState, useEffect, useRef } from 'react';

type ElementType = "h2" | "h4" | "p" | "span" | "blockquote" | "li";

interface EditableTextProps {
  as: ElementType;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  isTextarea?: boolean;
}

const EditableText: React.FC<EditableTextProps> = ({
  as,
  value,
  onChange,
  className = '',
  inputClassName = '',
  isTextarea = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    if (currentValue.trim() !== value.trim()) {
      onChange(currentValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !isTextarea) {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    const commonProps = {
      ref: inputRef as any,
      value: currentValue,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCurrentValue(e.target.value),
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      className: `w-full p-1 rounded-md text-brand-text focus:ring-1 focus:ring-brand-primary outline-none ${className} ${inputClassName}`,
    };
    return isTextarea ? (
      <textarea {...commonProps} rows={3} />
    ) : (
      <input type="text" {...commonProps} />
    );
  }

  const Tag = as;
  return (
    <Tag onClick={() => setIsEditing(true)} className={`${className} cursor-pointer hover:bg-brand-secondary/30 rounded-md transition-colors duration-150 p-1 -m-1`}>
      {value}
    </Tag>
  );
};

export default EditableText;