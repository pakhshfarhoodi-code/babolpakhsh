import React, { useState, useEffect } from 'react';
import { getCategoryFallbackImage, sanitizeImageUrl } from '../../utils/imageUtils';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  categoryId?: string;
  productName?: string;
  className?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  categoryId,
  productName,
  className = '',
  ...props
}) => {
  const initialSrc = sanitizeImageUrl(src, categoryId, productName);
  const [imgSrc, setImgSrc] = useState<string>(initialSrc);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    const sanitized = sanitizeImageUrl(src, categoryId, productName);
    setImgSrc(sanitized);
    setHasError(false);
  }, [src, categoryId, productName]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(getCategoryFallbackImage(categoryId, productName));
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      onError={handleError}
      className={className}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
};
