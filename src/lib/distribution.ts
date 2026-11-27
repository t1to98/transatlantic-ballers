// Linear interpolation between the two adjacent observations at each quartile.
export function quartiles(sorted: number[]) {
  if (!sorted.length) return null;
  function at(fraction: number) {
    const index = (sorted.length - 1) * fraction;
    const left = sorted[Math.floor(index)];
    return left + (sorted[Math.ceil(index)] - left) * (index % 1);
  }
  return { low: sorted[0], q1: at(.25), median: at(.5), q3: at(.75), high: sorted[sorted.length - 1] };
}

// Keep x exact. Move close neighbors into alternating rows above and below the axis.
export function stackDots(sortedX: number[], spacing: number) {
  const lastX: number[] = [];
  return sortedX.map(x => {
    let lane = lastX.findIndex(previous => x - previous >= spacing);
    if (lane < 0) lane = lastX.length;
    lastX[lane] = x;
    return (lane % 2 ? -1 : 1) * Math.ceil(lane / 2) * spacing;
  });
}
