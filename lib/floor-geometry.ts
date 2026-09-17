export function floorPosition(
  x: number,
  y: number,
  dx: number,
  dy: number,
  zoom: number,
  width: number,
  height: number,
) {
  const snap = (value: number, limit: number) =>
    Math.max(0, Math.min(Math.max(0, limit), Math.round(value / 10) * 10));
  return {
    x: snap(x + dx / zoom, 1000 - width),
    y: snap(y + dy / zoom, 850 - height),
  };
}
