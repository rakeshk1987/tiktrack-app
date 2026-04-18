/**
 * Smooth SVG Curve utility based on cubic bezier interpolation
 * Generates an SVG path string from an array of X/Y coordinates.
 */
export function generateBezierPath(points: { x: number; y: number }[], smooth = 0.2): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  // Calculate control points
  const getControlPoints = (i: number) => {
    const p1 = points[i - 1] || points[i];
    const p2 = points[i];
    const p3 = points[i + 1] || points[i];
    
    return {
      cp1x: p2.x - (p3.x - p1.x) * smooth,
      cp1y: p2.y - (p3.y - p1.y) * smooth,
      cp2x: p2.x + (p3.x - p1.x) * smooth,
      cp2y: p2.y + (p3.y - p1.y) * smooth
    };
  };

  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = getControlPoints(i - 1);
    const curr = getControlPoints(i);
    
    path += ` C ${prev.cp2x},${prev.cp2y} ${curr.cp1x},${curr.cp1y} ${points[i].x},${points[i].y}`;
  }

  return path;
}
