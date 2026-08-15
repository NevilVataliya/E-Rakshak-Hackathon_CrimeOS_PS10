import React from 'react';
import { useDynamicTranslate } from '../../lib/useDynamicTranslate';

interface TranslatedTextProps {
  text?: string | null;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

export const TranslatedText: React.FC<TranslatedTextProps> = ({
  text,
  className,
  as: Component = 'span'
}) => {
  const translated = useDynamicTranslate(text);

  if (!text) return null;

  return <Component className={className}>{translated}</Component>;
};

export default TranslatedText;
