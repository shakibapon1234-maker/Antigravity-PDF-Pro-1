import { describe, it, expect } from 'vitest';
import { hexToRgb } from '../core/utils.js';

describe('hexToRgb', () => {
  it('should parse 6-character hex colors correctly', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 1, g: 1, b: 1 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#ff0000')).toEqual({ r: 1, g: 0, b: 0 });
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 1, b: 0 });
    expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 1 });
  });

  it('should handle rgb strings correctly', () => {
    expect(hexToRgb('rgb(255, 255, 255)')).toEqual({ r: 1, g: 1, b: 1 });
    expect(hexToRgb('rgb(0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('should fallback to white on invalid inputs', () => {
    expect(hexToRgb('invalid')).toEqual({ r: 1, g: 1, b: 1 });
    expect(hexToRgb('')).toEqual({ r: 1, g: 1, b: 1 });
    expect(hexToRgb('transparent')).toEqual({ r: 1, g: 1, b: 1 });
  });
});
