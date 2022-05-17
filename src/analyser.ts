#!/usr/bin/env node
/* eslint-disable sonarjs/no-duplicate-string */

import * as mqtt from "mqtt";
import { args, askUsername, askPassword, askMeasurements } from "./cli-utils";
import {
  mqttStartClient,
  subscripeToTopic,
  publishDelay,
  nextDelay,
  delayValues,
} from "./mqtt-utils";
import chalk from "chalk";
import { createSpinner } from "nanospinner";
import pkg from "lodash";
const { mean } = pkg;

const host = args["host"] || process.env["MQTT_HOST"] || "localhost";
const port = args["port"] || process.env["MQTT_PORT"] || "1883";
const username =
  args["username"] || process.env["MQTT_USERNAME"] || (await askUsername());
const password =
  args["password"] || process.env["MQTT_PASSWORD"] || (await askPassword());
const DURATION_PER_MEASUREMENT = (args["durationPerMeasurement"] ||
  process.env["DURATION_PER_MEASUREMENT"] ||
  (await askMeasurements())) as number;

let qos: mqtt.QoS = 0; // 0, 1 or 2
let delay: publishDelay = 0; // ms
let startTime = 0;
let measurementsTaken = 0;
let receivedMessages = 0;
let receivedMessagesOutOfOrder = 0;
let prevCount = -1;
let maxCount = -1;
let lastMeasurementTime: number | undefined = undefined;
let delayBetweenMessages: number[] = [];
let hasTimerStarted = false;
let analyserStatusMessage = "";

const metrics = [
  "Average Rate (messages/second)",
  "Message Loss (%)",
  "Messages Out-of-Order (%)",
  "Mean Inter-Message-Gap (ms)",
  "Median Inter-Message-Gap (ms)",
] as const;
// TODO abstraction

const resultsTable = new Map();
let currentTableStr = "";

metrics.forEach((m) => {
  [0, 1, 2].forEach((q) => {
    delayValues.forEach((d) => {
      resultsTable.set(`${m}/${q}/${d}`, "0");
    });
  });
});
function resultsTableString(table: Map<string, number>, isFinal = false) {
  let result = "";
  const maxDigits = Array.from(table.values()).reduce((prev, curr) => {
    const currLength = String(Math.abs(curr)).length;
    prev = currLength > prev ? currLength : prev;
    return prev;
  }, 1);

  metrics.forEach((m) => {
    // eslint-disable-next-line sonarjs/no-nested-template-literals
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
    [0, 1, 2].forEach((q) => {
      result += `QoS ${q} ${chalk.gray("│")} `;
      delayValues.forEach((d) => {
        // TODO check undefined
        const val = table.get(`${m}/${q}/${d}`) || 0;
        for (let x = 0; x < maxDigits - String(val).length; x++) {
          result += " ";
        }
        result += q == qos && d == delay && !isFinal ? chalk.yellow(val) : val;
        result += ` ${chalk.gray("│")} `;
      });
      result += "\n";
    });
    result += "\n";
  });
  return result;
}

// TODO update everything in table
function calculateResults(
  qos: mqtt.QoS,
  delay: publishDelay,
  receivedMessages: number,
  receivedMessagesOutOfOrder: number,
  maxCount: number,
  delayBetweenMessages: number[],
) {
  // rate
  resultsTable.set(`${metrics[0]}/${qos}/${delay}`, receivedMessages);
  // loss
  resultsTable.set(
    `${metrics[1]}/${qos}/${delay}`,
    ((maxCount / (receivedMessages - 1)) * 100 - 100).toFixed(),
  );
  // out-of-order
  resultsTable.set(
    `${metrics[2]}/${qos}/${delay}`,
    ((receivedMessagesOutOfOrder / receivedMessages) * 100).toFixed(),
  );
  // mean gap
  resultsTable.set(
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

  resultsTable.set(
    `${metrics[4]}/${qos}/${delay}`,
    median(delayBetweenMessages).toFixed(),
  );
}

const spinner = createSpinner(
  chalk.blue(
    `Waiting for messages on topic ${chalk.yellow(
      `counter/${qos}/${delay}`,
    )}...`,
  ),
);

const client: mqtt.MqttClient = await mqttStartClient(
  host,
  port,
  username,
  password,
  "Analyser",
  () => {
    takeMeasurements();
    spinner.start();
  },
);

subscripeToTopic(client, "counter/#");

client.publish("request/qos", qos.toString(), { retain: true });
client.publish("request/delay", delay.toString(), { retain: true });

client.on("message", (topic, message) => {
  // TODO validate topic
  if (topic === `counter/${qos}/${delay}`) {
    receivedMessages++;
    if (parseInt(message.toString()) !== prevCount + 1)
      receivedMessagesOutOfOrder++;
    prevCount = parseInt(message.toString());
    maxCount = Math.max(maxCount, prevCount);
    if (lastMeasurementTime !== undefined)
      delayBetweenMessages.push(new Date().getTime() - lastMeasurementTime);
    lastMeasurementTime = new Date().getTime();
  }
});

async function takeMeasurements() {
  const interval = setInterval(function () {
    if (measurementsTaken < 21) {
      if (receivedMessages > 0 && !hasTimerStarted) {
        // start timer on first message received from publisher on specified topic
        startTime = new Date().getTime();
        hasTimerStarted = true;
      } else if (
        new Date().getTime() - startTime > DURATION_PER_MEASUREMENT &&
        hasTimerStarted
      ) {
        hasTimerStarted = false;
        measurementsTaken++;
        calculateResults(
          qos,
          delay,
          receivedMessages,
          receivedMessagesOutOfOrder,
          maxCount,
          delayBetweenMessages,
        );
        if (delay < 200) {
          delay = nextDelay(delay) || 200;
          client.publish("request/qos", qos.toString(), { retain: true });
          client.publish("request/delay", delay.toString(), { retain: true });
        } else if (qos < 2) {
          qos++;
          delay = 0;
          client.publish("request/qos", qos.toString(), { retain: true });
          client.publish("request/delay", delay.toString(), { retain: true });
        }
        currentTableStr = resultsTableString(resultsTable);
        receivedMessages = 0;
        receivedMessagesOutOfOrder = 0;
        prevCount = -1;
        maxCount = -1;
        lastMeasurementTime = undefined;
        delayBetweenMessages = [];
      }
      // update spinner
      let currentTime = new Date().getTime();
      if (hasTimerStarted) {
        analyserStatusMessage = "";
      } else {
        analyserStatusMessage = `  Waiting for messages on topic ${chalk.yellow(
          `counter/${qos}/${delay}`,
        )}`;
        currentTime = startTime;
      }
      spinner.update({
        text: chalk.blue(
          `Analysing QoS ${chalk.yellow(qos)} with a delay of ${chalk.yellow(
            delay,
          )} - Progress: ${chalk.yellow(
            `${(
              ((currentTime - startTime) / DURATION_PER_MEASUREMENT) *
              100
            ).toFixed()}%`,
          )} - Measurements: ${chalk.yellow(
            `${measurementsTaken} / 21`,
          )}\n${analyserStatusMessage}\n${currentTableStr}`,
        ),
      });
    } else {
      clearInterval(interval);
      setTimeout(() => {
        currentTableStr = resultsTableString(resultsTable, true);
        spinner.success({
          text: `${chalk.green("Finished analysing\n\n")}${chalk.blue(
            currentTableStr,
          )}`,
        });
        process.exit(0);
      }, DURATION_PER_MEASUREMENT * 2);
    }
  }, 0);
}
