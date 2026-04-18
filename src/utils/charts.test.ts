import { describe, expect, it } from 'vitest';
import { generateBezierPath } from './charts';

describe('generateBezierPath', () => {
  it('returns empty string for no points', () => {
    expect(generateBezierPath([])).toBe('');
  });

  it('returns M command for single point', () => {
    expect(generateBezierPath([{ x: 10, y: 20 }])).toBe('M 10,20');
  });

  it('generates a path with C commands for multiple points', () => {
    const points = [
      { x: 0, y: 100 },
      { x: 50, y: 50 },
      { x: 100, y: 80 }
    ];
    const path = generateBezierPath(points);
    expect(path).toMatch(/^M 0,100/);
    expect(path).toContain('C');
    expect(path).toContain('100,80');
  });

  it('handles two points correctly', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ];
    const path = generateBezierPath(points);
    expect(path).toMatch(/^M 0,0/);
    expect(path).toContain('C');
    expect(path).toContain('100,100');
  });

  it('respects custom smoothing factor', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 }
    ];
    const path1 = generateBezierPath(points, 0.1);
    const path2 = generateBezierPath(points, 0.5);
    // Different smoothing should produce different control points
    expect(path1).not.toBe(path2);
  });
});
