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
let receivedMessages = 0;
let measurementsTaken = 0;
let startTime = 0;
// let lastMeasurementTime = 0;
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
function generateTable(): Map<string, number> {
  const rtn = new Map();
  [0, 1, 2].forEach((q) => {
    delayValues.forEach((d) => {
      rtn.set(`${q}/${d}`, "0");
    });
  });
  return rtn;
}
const receivedTable = generateTable();
const prevCountTable = generateTable();
// const prevTimeTable = generateTable();

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
  receivedMessages: number | undefined = undefined,
) {
  // rate
  if (receivedMessages != undefined)
    resultsTable.set(`${metrics[0]}/${qos}/${delay}`, receivedMessages);
  // loss
  resultsTable.set(
    `${metrics[1]}/${qos}/${delay}`,
    (
      ((prevCountTable.get(`${qos}/${delay}`) || 0) /
        ((receivedTable.get(`${qos}/${delay}`) || 0) - 1)) *
        100 -
      100
    ).toFixed(),
  );
  // TODO out-of-order
  resultsTable.set(
    `${metrics[2]}/${qos}/${delay}`,
    receivedTable.get(`${qos}/${delay}`),
  );
  // TODO mean gap
  resultsTable.set(
    `${metrics[3]}/${qos}/${delay}`,
    receivedTable.get(`${qos}/${delay}`),
  );
  // TODO median gap
  resultsTable.set(
    `${metrics[4]}/${qos}/${delay}`,
    receivedTable.get(`${qos}/${delay}`),
  );
}

const spinnerAnalyser = createSpinner(
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
    spinnerAnalyser.start();
  },
);

subscripeToTopic(client, "counter/#");

client.publish("request/qos", qos.toString(), { retain: true });
client.publish("request/delay", delay.toString(), { retain: true });

client.on("message", (topic, message) => {
  // TODO validate topic
  if (topic.startsWith("counter/")) {
    if (topic === `counter/${qos}/${delay}`) {
      receivedMessages++;
    }
    prevCountTable.set(
      `${topic.split("/")[1]}/${topic.split("/")[2]}`,
      parseInt(message.toString()),
    );
    receivedTable.set(
      `${topic.split("/")[1]}/${topic.split("/")[2]}`,
      (prevCountTable.get(`${topic.split("/")[1]}/${topic.split("/")[2]}`) ||
        0) + 1,
    );
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
        calculateResults(qos, delay, receivedMessages);
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
      spinnerAnalyser.update({
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
        calculateResults(qos, delay); // TODO update all
        currentTableStr = resultsTableString(resultsTable, true);
        spinnerAnalyser.success({
          text: `${chalk.green("Finished analysing\n\n")}${chalk.blue(
            currentTableStr,
          )}`,
        });
        process.exit(0);
      }, DURATION_PER_MEASUREMENT * 2);
    }
  }, 0);
}
