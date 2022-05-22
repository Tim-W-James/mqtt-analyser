import chalk from "chalk";
import pkg from "lodash";
import * as mqtt from "mqtt";
import { delayValues, publishDelay } from "./delay";
const { mean } = pkg;

// specify metrics to track on the table
const metrics = [
  "Average Rate (messages/second)",
  "Message Loss (%)",
  "Messages Out-of-Order (%)",
  "Mean Inter-Message-Gap (ms)",
  "Median Inter-Message-Gap (ms)",
] as const;

interface resultsTable {
  table: Map<string, string>;
  currentTableStr: string;
}

// populate table with initial values
function createResultsTable() {
  const table = new Map();
  metrics.forEach((m) => {
    [0, 1, 2].forEach((q) => {
      delayValues.forEach((d) => {
        table.set(`${m}/${q}/${d}`, "0");
      });
    });
  });
  return {
    table: table,
    currentTableStr: "",
  };
}

/**
 * Output the results table as a string
 *
 * @param  {Map<string, string>} table
 * @param  {mqtt.QoS} qos?
 * @param  {publishDelay} delay?
 * @returns string
 */
function resultsTableString(
  table: Map<string, string>,
  qos?: mqtt.QoS,
  delay?: publishDelay,
): string {
  let result = "";
  // determine the horizontal size of each cell
  const maxDigits = Array.from(table.values()).reduce((prev, curr) => {
    const currLength = curr.length;
    prev = currLength > prev ? currLength : prev;
    return prev;
  }, 1);

  metrics.forEach((m) => {
    // print delay values header
    result += `${chalk.yellow(`${m}:`)}\nDelay ${chalk.gray("│")}`;
    delayValues.forEach((d) => {
      result += " ";
      for (let x = 0; x < maxDigits - String(Math.abs(d)).length; x++) {
        result += " ";
      }
      result += `${d} ${chalk.gray("│")}`;
    });
    result += chalk.gray("\n──────┼");
    delayValues.forEach((d) => {
      for (let x = 0; x < maxDigits; x++) {
        result += chalk.gray("─");
      }
      result +=
        d === delayValues[delayValues.length - 1]
          ? chalk.gray("──┤")
          : chalk.gray("──┼");
    });
    result += "\n";
    // print table values
    [0, 1, 2].forEach((q) => {
      result += `QoS ${q} ${chalk.gray("│")} `;
      delayValues.forEach((d) => {
        const val = table.get(`${m}/${q}/${d}`) || 0;
        for (let x = 0; x < maxDigits - String(val).length; x++) {
          result += " ";
        }
        // highlight the current value
        if (!(qos === undefined || delay === undefined)) {
          result += q == qos && d == delay ? chalk.yellow(val) : val;
        } else {
          result += val;
        }
        result += ` ${chalk.gray("│")} `;
      });
      result += "\n";
    });
    result += "\n";
  });
  return result;
}

/**
 * Calculate metrics for a specific qos/delay value
 *
 * @param  {Map<string, string>} table
 * @param  {mqtt.QoS} qos
 * @param  {publishDelay} delay
 * @param  {number} receivedMessages
 * @param  {number} receivedMessagesOutOfOrder
 * @param  {number} maxCount
 * @param  {number[]} delayBetweenMessages
 */
function calculateResults(
  table: Map<string, string>,
  qos: mqtt.QoS,
  delay: publishDelay,
  receivedMessages: number,
  receivedMessagesOutOfOrder: number,
  maxCount: number,
  delayBetweenMessages: number[],
) {
  // rate
  table.set(`${metrics[0]}/${qos}/${delay}`, receivedMessages.toString());
  // loss
  table.set(
    `${metrics[1]}/${qos}/${delay}`,
    ((maxCount / (receivedMessages - 1)) * 100 - 100).toFixed(),
  );
  // out-of-order
  table.set(
    `${metrics[2]}/${qos}/${delay}`,
    ((receivedMessagesOutOfOrder / receivedMessages) * 100).toFixed(),
  );
  // mean gap
  table.set(
    `${metrics[3]}/${qos}/${delay}`,
    mean(delayBetweenMessages).toFixed(),
  );
  // median gap
  function median(values: number[]): number {
    if (delayBetweenMessages.length === 0) return 0;
    values.sort(function (a, b) {
      return a - b;
    });
    const middle = Math.floor(values.length / 2);
    if (values.length % 2) return values[middle] || 0;
    return ((values[middle - 1] || 0) + (values[middle] || 0)) / 2.0;
  }
  table.set(
    `${metrics[4]}/${qos}/${delay}`,
    median(delayBetweenMessages).toFixed(),
  );
}

export {
  createResultsTable,
  resultsTableString,
  calculateResults,
  resultsTable,
};
