#!/usr/bin/env node
import chalk from "chalk";
import * as mqtt from "mqtt";
import { args, askMeasurements, askPassword, askUsername } from "./cliUtils";
import { nextDelay, publishDelay } from "./delay";
import { mqttStartClient, subscribeToTopic } from "./mqttUtils";
import {
  calculateResults,
  createResultsTable,
  resultsTableString,
  resultsTable,
} from "./resultsTable";

// initialize parameters from command line arguments or env vars
// defaults to localhost:1883 with no username or password
const HOST = args["host"] || process.env["MQTT_HOST"] || "localhost";
const PORT = args["port"] || process.env["MQTT_PORT"] || "1883";
const USERNAME =
  args["username"] || process.env["MQTT_USERNAME"] || (await askUsername());
const PASSWORD =
  args["password"] || process.env["MQTT_PASSWORD"] || (await askPassword());
const DURATION_PER_MEASUREMENT = (args["durationPerMeasurement"] ||
  process.env["DURATION_PER_MEASUREMENT"] ||
  (await askMeasurements())) as number;

// current values the analyser is taking measurements on
let qos: mqtt.QoS = 0; // 0, 1 or 2
let delay: publishDelay = 0; // ms
// analyse each pair of values for a specified amount of time
let startTime = 0;
let hasTimerStarted = false;
//
let measurementsTaken = 0;
let receivedMessages = 0;
let receivedMessagesOutOfOrder = 0;
let prevCount = -1;
let maxCount = -1;
let lastMeasurementTime: number | undefined = undefined;
let delayBetweenMessages: number[] = [];
let hasSentWaitingMessage = false;
const resultsTable: resultsTable = createResultsTable();

// initialize the mqtt client with provided arguments
const client: mqtt.MqttClient = await mqttStartClient(
  HOST,
  PORT,
  USERNAME,
  PASSWORD,
  "Analyser",
  () => takeMeasurements(),
);

// the analyser subscribes to count/<qos>/<delay> and publishes to request/qos
// and request/delay
subscribeToTopic(client, "counter/#", qos);
client.publish("request/qos", qos.toString(), { retain: true });
client.publish("request/delay", delay.toString(), { retain: true });

// respond to message from publisher and update metrics
client.on("message", (topic, message) => {
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
  // poll metrics for each pair of qos/delay values until timer has run out
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
            )} for ${chalk.yellow(`${DURATION_PER_MEASUREMENT}ms`)}`,
          ),
        );
      } else if (
        new Date().getTime() - startTime > DURATION_PER_MEASUREMENT &&
        hasTimerStarted
      ) {
        // calculate and display a set of metrics for a given qos/delay value
        // once timer has expired
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
        // increment to the next qos/delay value
        if (delay < 200) {
          delay = nextDelay(delay) || 200;
        } else if (qos < 2) {
          qos++;
          delay = 0;
        }
        // change QoS level of subscription
        client.unsubscribe("counter/#");
        subscribeToTopic(client, "counter/#", qos);
        // publish the new qos/delay value
        client.publish("request/qos", qos.toString(), { retain: true });
        client.publish("request/delay", delay.toString(), { retain: true });
        resultsTable.currentTableStr = resultsTableString(
          resultsTable.table,
          qos,
          delay,
        );
        console.log(
          `Finished receiving messages on topic ${chalk.yellow(
            `counter/${qos}/${delay}`,
          )}\n${resultsTable.currentTableStr}`,
        );
        // reset metrics for the next measurement
        hasSentWaitingMessage = false;
        receivedMessages = 0;
        receivedMessagesOutOfOrder = 0;
        prevCount = -1;
        maxCount = -1;
        lastMeasurementTime = undefined;
        delayBetweenMessages = [];
      } else if (receivedMessages === 0 && !hasSentWaitingMessage) {
        // notify if waiting to get messages from the subscriber
        hasSentWaitingMessage = true;
        console.log(
          chalk.visible(
            `Waiting for messages on topic ${chalk.yellow(
              `counter/${qos}/${delay}`,
            )}`,
          ),
        );
      }
    } else {
      // once all measurements have been collected, terminate the process
      clearInterval(interval);
      resultsTable.currentTableStr = resultsTableString(resultsTable.table);
      console.log(
        chalk.visible(
          `${chalk.green("Finished analysing\n\n")}${chalk.visible(
            resultsTable.currentTableStr,
          )}`,
        ),
      );
      process.exit(0);
    }
  }, 0);
}
