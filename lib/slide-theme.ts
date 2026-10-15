export function slidePalette(background = "#080D1C") {
  const hex = background.slice(1);
  const values = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const light = values[0] * 0.299 + values[1] * 0.587 + values[2] * 0.114 > 170;
  return {
    text: light ? "#17283B" : "#F4F7FF",
    muted: light ? "#54677B" : "#ABB7D0",
    accent: light ? "#087C69" : "#64F5DA",
  };
}
