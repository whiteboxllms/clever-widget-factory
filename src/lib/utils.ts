import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hasActualContent(text?: string): boolean {
  if (!text) return false;
  
  // Strip HTML tags and decode entities
  const strippedText = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&[a-zA-Z0-9#]+;/g, '') // Remove other HTML entities
    .trim();
  
  return strippedText.length > 0;
}
