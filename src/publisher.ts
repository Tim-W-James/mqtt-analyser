#!/usr/bin/env node

import chalk from "chalk";
import * as mqtt from "mqtt";
import { args, askMeasurements, askPassword, askUsername } from "./cliUtils";
import { isValidDelay, publishDelay, sleep } from "./delay";
import { mqttStartClient, subscripeToTopic } from "./mqttUtils";

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

// current values the publisher is sending
let qos: mqtt.QoS | undefined = undefined; // 0, 1 or 2
let delay: publishDelay | undefined = undefined; // ms

// create the mqtt client with provided arguments
const client: mqtt.MqttClient = await mqttStartClient(
  HOST,
  PORT,
  USERNAME,
  PASSWORD,
  "Publisher",
  () => {
    subscripeToTopic(client, "request/qos");
    subscripeToTopic(client, "request/delay");
    console.log(
      chalk.visible(
        `The publisher will send messages for ${chalk.yellow(
          `${DURATION_PER_MEASUREMENT}ms`,
        )} to ${chalk.yellow("counter/<qos>/<delay>")}`,
      ),
    );
  },
);

/**
 * Publish messages with the specified qos and delay
 *
 * @param  {mqtt.QoS} qos
 * @param  {publishDelay} delay
 */
async function publishMessages(qos: mqtt.QoS, delay: publishDelay) {
  // send as many messages as possible within the time limit
  let counter = 0;
  await sleep(0);
  const startTime = new Date().getTime();
  const interval = setInterval(function () {
    if (new Date().getTime() - startTime > DURATION_PER_MEASUREMENT) {
      clearInterval(interval);
      console.log(
        chalk.green(
          `Finished sending messages to topic ${chalk.yellow(
            `counter/${qos}/${delay}`,
          )} - Messages sent: ${chalk.yellow(counter)}`,
        ),
      );
      console.log(
        chalk.visible(
          `Waiting for a QoS to be set on topic ${chalk.yellow(
            "request/qos",
          )} and a Delay on ${chalk.yellow("request/delay")} `,
        ),
      );
      return;
    }
    client.publish(`counter/${qos}/${delay}`, `${counter}`, { qos: qos });
    counter++;
    if (counter === 1) {
      console.log(
        chalk.visible(
          `Sending messages to topic ${chalk.yellow(
            `counter/${qos}/${delay}`,
          )} for ${chalk.yellow(`${DURATION_PER_MEASUREMENT}ms`)}`,
        ),
      );
    }
  }, delay);
}

// publish messages when a qos/delay is received
client.on("message", (topic, message) => {
  switch (topic) {
    case "request/qos":
      // eslint-disable-next-line no-case-declarations
      const newQoS = parseInt(message.toString());
      if (newQoS <= 0 && newQoS >= 2) {
        console.error(
          chalk.red(
            `\nInvalid QoS value ${message} received - Must be 0, 1 or 2`,
          ),
        );
      } else {
        qos = newQoS as mqtt.QoS;
        if (delay !== undefined) {
          publishMessages(qos, delay);
          qos = undefined;
          delay = undefined;
        }
      }
      break;
    case "request/delay":
      // eslint-disable-next-line no-case-declarations
      const newDelay = parseInt(message.toString());
      if (!isValidDelay(newDelay)) {
        console.error(
          chalk.red(
            `\nInvalid Delay value ${message} received - ` +
              `Must be 0, 1, 2, 10, 20, 100, or 200`,
          ),
        );
      } else {
        delay = newDelay as publishDelay;
        if (qos !== undefined) {
          publishMessages(qos, delay);
          qos = undefined;
          delay = undefined;
        }
      }
      break;
    default:
      break;
  }
});
