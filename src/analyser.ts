#!/usr/bin/env node
/* eslint-disable sonarjs/no-duplicate-string */

import chalk from "chalk";
import * as mqtt from "mqtt";
import { createSpinner } from "nanospinner";
import { args, askMeasurements, askPassword, askUsername } from "./cliUtils";
import { nextDelay, publishDelay } from "./delay";
import { mqttStartClient, subscripeToTopic } from "./mqttUtils";
import {
  calculateResults,
  createResultsTable,
  resultsTableString,
} from "./resultsTable";

const host = args["host"] || process.env["MQTT_HOST"] || "localhost";
const port = args["port"] || process.env["MQTT_PORT"] || "1883";
const username =
  args["username"] || process.env["MQTT_USERNAME"] || (await askUsername());
const password =
  args["password"] || process.env["MQTT_PASSWORD"] || (await askPassword());
const DURATION_PER_MEASUREMENT = (args["durationPerMeasurement"] ||
  process.env["DURATION_PER_MEASUREMENT"] ||
  (await askMeasurements())) as number;
const displayLiveResults = args["live"] || false;

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

interface resultsTable {
  table: Map<string, string>;
  currentTableStr: string;
}

const resultsTable: resultsTable = createResultsTable();

const spinner = createSpinner(
  chalk.visible(
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
    if (displayLiveResults) spinner.start();
    else
      console.log(
        chalk.visible(
          `Waiting for messages on topic ${chalk.yellow(
            `counter/${qos}/${delay}`,
          )}...`,
        ),
      );
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
  // eslint-disable-next-line sonarjs/cognitive-complexity
  const interval = setInterval(function () {
    if (measurementsTaken < 21) {
      if (receivedMessages > 0 && !hasTimerStarted) {
        // start timer on first message received from publisher on specified topic
        startTime = new Date().getTime();
        hasTimerStarted = true;
        console.log(
          chalk.visible(
            `Receiving messages on topic ${chalk.yellow(
              `counter/${qos}/${delay}`,
            )}`,
          ),
        );
      } else if (
        new Date().getTime() - startTime > DURATION_PER_MEASUREMENT &&
        hasTimerStarted
      ) {
        hasTimerStarted = false;
        measurementsTaken++;
        calculateResults(
          resultsTable.table,
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
          console.log(
            chalk.visible(
              `Waiting for messages on topic ${chalk.yellow(
                `counter/${qos}/${delay}`,
              )}`,
            ),
          );
        } else if (qos < 2) {
          qos++;
          delay = 0;
          client.publish("request/qos", qos.toString(), { retain: true });
          client.publish("request/delay", delay.toString(), { retain: true });
          console.log(
            chalk.visible(
              `Waiting for messages on topic ${chalk.yellow(
                `counter/${qos}/${delay}`,
              )}`,
            ),
          );
        }
        resultsTable.currentTableStr = resultsTableString(
          resultsTable.table,
          qos,
          delay,
        );
        // TODO print intermediate results
        if (!displayLiveResults) {
          console.log(
            `Finished receiving messages on topic ${chalk.yellow(
              `counter/${qos}/${delay}`,
            )}\n${resultsTable.currentTableStr}`,
          );
        }
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
      if (displayLiveResults) {
        spinner.update({
          text: chalk.visible(
            `Analysing QoS ${chalk.yellow(qos)} with a delay of ${chalk.yellow(
              delay,
            )} - Progress: ${chalk.yellow(
              `${(
                ((currentTime - startTime) / DURATION_PER_MEASUREMENT) *
                100
              ).toFixed()}%`,
            )} - Measurements: ${chalk.yellow(
              `${measurementsTaken} / 21`,
            )}\n${analyserStatusMessage}\n${resultsTable.currentTableStr}`,
          ),
        });
      }
    } else {
      clearInterval(interval);
      resultsTable.currentTableStr = resultsTableString(resultsTable.table);
      if (displayLiveResults) {
        spinner.success({
          text: `${chalk.green("Finished analysing\n\n")}${chalk.visible(
            resultsTable.currentTableStr,
          )}`,
        });
      } else {
        console.log(
          chalk.visible(
            `${chalk.green("Finished analysing\n\n")}${chalk.visible(
              resultsTable.currentTableStr,
            )}`,
          ),
        );
      }
      process.exit(0);
    }
  }, 0);
}
