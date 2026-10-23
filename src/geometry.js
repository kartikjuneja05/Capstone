export function angle(a, b, c) {
  const u = [a.x-b.x,a.y-b.y], v = [c.x-b.x,c.y-b.y];
  const magnitude = Math.hypot(...u)*Math.hypot(...v);
  if (magnitude < 1e-8) return null;
  return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/magnitude)))*180/Math.PI;
}
