// enum for delay
const delayValues = [0, 1, 2, 10, 20, 100, 200] as const;
type publishDelay = typeof delayValues[number];

function nextDelay(delay: publishDelay) {
  return delayValues[(delayValues.indexOf(delay) + 1) % delayValues.length];
}

function isValidDelay(delay: number) {
  return delayValues.includes(delay as publishDelay);
}

function sleep(ms: number | undefined) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
export { publishDelay, nextDelay, isValidDelay, delayValues, sleep };
