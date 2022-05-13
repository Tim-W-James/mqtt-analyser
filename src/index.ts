#!/usr/bin/env node

import * as mqtt from "mqtt";
import { args, askUsername, askPassword } from "./cli-utils";
import mqttStartClient from "./mqtt-utils";
import chalk from "chalk";

console.log(chalk.blue("MQTT Publisher Starting up..."));

const host = args["host"] || process.env["MQTT_HOST"] || "localhost";
const port = args["port"] || process.env["MQTT_PORT"] || "1883";
const username =
  args["username"] || process.env["MQTT_USERNAME"] || (await askUsername());
const password =
  args["password"] || process.env["MQTT_PASSWORD"] || (await askPassword());

const client: mqtt.MqttClient = await mqttStartClient(
  host,
  port,
  username,
  password,
);

client.subscribe("comp3310", function (err) {
  if (!err) {
    client.publish("comp3310", "Hello mqtt");
  }
});
