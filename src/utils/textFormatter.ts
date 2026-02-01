/**
 * Text Formatter Utilities
 *
 * Provides formatting functions for TTS text output.
 * Based on fntm implementation.
 */

/**
 * Strip markdown formatting from text for TTS.
 * Removes syntax while preserving the readable content.
 */
export function stripMarkdown(text: string): string {
  let result = text;

  // Remove code blocks (``` ... ```)
  result = result.replace(/```[\s\S]*?```/g, '');

  // Remove inline code (`code`)
  result = result.replace(/`([^`]+)`/g, '$1');

  // Remove bold (**text** or __text__)
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');

  // Remove italic (*text* or _text_)
  result = result.replace(/\*([^*]+)\*/g, '$1');
  result = result.replace(/_([^_]+)_/g, '$1');

  // Remove strikethrough (~~text~~)
  result = result.replace(/~~([^~]+)~~/g, '$1');

  // Remove headers (# Header)
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Remove blockquotes (> quote)
  result = result.replace(/^>\s+/gm, '');

  // Remove horizontal rules (---, ***, ___)
  result = result.replace(/^[-*_]{3,}\s*$/gm, '');

  // Remove unordered list markers (- item, * item, + item)
  result = result.replace(/^[\s]*[-*+]\s+/gm, '');

  // Remove ordered list markers (1. item)
  result = result.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove links [text](url) -> text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove images ![alt](url)
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1 image');

  // Remove HTML tags
  result = result.replace(/<[^>]+>/g, '');

  // Clean up extra whitespace
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.trim();

  return result;
}

/**
 * Clean text for natural speech synthesis.
 * Strips markdown and makes additional adjustments for TTS.
 */
export function cleanForSpeech(text: string): string {
  let result = stripMarkdown(text);

  // Replace common abbreviations for better pronunciation
  result = result.replace(/\be\.g\./gi, 'for example');
  result = result.replace(/\bi\.e\./gi, 'that is');
  result = result.replace(/\betc\./gi, 'etcetera');
  result = result.replace(/\bvs\./gi, 'versus');

  // Add pauses after colons (for lists)
  result = result.replace(/:\s*\n/g, '. ');

  // Replace multiple newlines with period for natural pauses
  result = result.replace(/\n\n+/g, '. ');
  result = result.replace(/\n/g, ' ');

  // Clean up multiple spaces
  result = result.replace(/\s{2,}/g, ' ');

  // Clean up multiple periods
  result = result.replace(/\.{2,}/g, '.');
  result = result.replace(/\.\s*\./g, '.');

  return result.trim();
}
