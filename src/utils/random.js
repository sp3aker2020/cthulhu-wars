export function rollDice(count, rng = Math.random) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(rng() * 6) + 1);
  }
  return results;
}

export function interpretDice(results) {
  return results.reduce(
    (acc, val) => {
      if (val === 6) acc.kills++;
      else if (val === 4 || val === 5) acc.pains++;
      else if (val <= 3) acc.misses++;
      return acc;
    },
    { kills: 0, pains: 0, misses: 0 }
  );
}

export function shuffle(arr, rng = Math.random) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
