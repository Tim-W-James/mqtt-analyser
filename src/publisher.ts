#!/usr/bin/env node
/* eslint-disable sonarjs/no-duplicate-string */

import * as mqtt from "mqtt";
import { args, askUsername, askPassword, askMeasurements } from "./cli-utils";
import {
  mqttStartClient,
  subscripeToTopic,
  publishDelay,
  isValidDelay,
  sleep,
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

let qos: mqtt.QoS | undefined = undefined; // 0, 1 or 2
let delay: publishDelay | undefined = undefined; // ms

const client: mqtt.MqttClient = await mqttStartClient(
  host,
  port,
  username,
  password,
  "Publisher",
  () => {
    subscripeToTopic(client, "request/qos");
    subscripeToTopic(client, "request/delay");
    console.log(
      chalk.blue(
        `The publisher will send messages for ${chalk.yellow(
          `${DURATION_PER_MEASUREMENT}ms`,
        )} to ${chalk.yellow("counter/<qos>/<delay>")}`,
      ),
    );
  },
);

async function publishMessages(qos: mqtt.QoS, delay: publishDelay) {
  const spinner = createSpinner(
    // eslint-disable-next-line sonarjs/no-nested-template-literals
    chalk.blue(
      `Waiting for a QoS to be set on topic ${chalk.yellow(
        "request/qos",
      )} and a Delay on ${chalk.yellow("request/delay")} `,
    ),
  ).start();
  let counter = 0;
  await sleep(0);
  // let messagesToSend = DURATION_PER_MEASUREMENT / delay;
  const startTime = new Date().getTime();
  const interval = setInterval(function () {
    if (new Date().getTime() - startTime > DURATION_PER_MEASUREMENT) {
      clearInterval(interval);
      spinner.success({
        text: chalk.green(
          `Finished sending messages to topic ${chalk.yellow(
            `counter/${qos}/${delay}`,
          )} - Messages sent: ${chalk.yellow(counter)}`,
        ),
      });
      return;
    }
    client.publish(`counter/${qos}/${delay}`, `${counter}`, { qos: qos });
    counter++;
    spinner.update({
      text: chalk.blue(
        `Sending messages to topic ${chalk.yellow(
          `counter/${qos}/${delay}`,
        )} - Progress: ${chalk.yellow(
          `${(
            ((new Date().getTime() - startTime) / DURATION_PER_MEASUREMENT) *
            100
          ).toFixed()}%`,
        )} - Messages sent: ${chalk.yellow(counter)}`,
      ),
    });
  }, delay);
}
// TODO calc messages to send by delay + duration
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
