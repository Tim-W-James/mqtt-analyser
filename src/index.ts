#!/usr/bin/env node

import * as mqtt from "mqtt";
import "dotenv/config";
import minimist from "minimist";
import chalk from "chalk";
import inquirer from "inquirer";
import { createSpinner } from "nanospinner";

const args = minimist(process.argv.slice(2), {
  string: ["host", "port", "username", "password"],
  alias: { h: "host", p: "port", u: "username", P: "password" },
});

async function askUsername() {
  const { username } = await inquirer.prompt({
    type: "input",
    name: "username",
    message: "Enter username:",
    default() {
      return "admin";
    },
  });
  return username;
}

async function askPassword() {
  const { password } = await inquirer.prompt({
    type: "input",
    name: "password",
    message: "Enter password:",
    default() {
      return "***";
    },
  });
  return password;
}

console.log(chalk.blue("MQTT Publisher Starting up..."));

const host = args["host"] || process.env["MQTT_HOST"] || "localhost";
const port = args["port"] || process.env["MQTT_PORT"] || "1883";
const username =
  args["username"] || process.env["MQTT_USERNAME"] || (await askUsername());
const password =
  args["password"] || process.env["MQTT_PASSWORD"] || (await askPassword());

async function mqttBroker(
  host: string,
  port: string,
  username: string,
  password: string,
) {
  const spinner = createSpinner(
    chalk.blue(`Connecting to mqtt://${host}:${port}...`),
  ).start();

  const client: mqtt.MqttClient = mqtt.connect(`mqtt://${host}:${port}`, {
    username: username,
    password: password,
    connectTimeout: 5000,
    clientId: "Publisher",
  });

  client.on("connect", () => {
    spinner.success({
      text: chalk.green(`Connected to broker mqtt://${host}:${port}`),
    });
    client.subscribe("comp3310", function (err) {
      if (!err) {
        client.publish("comp3310", "Hello mqtt");
      }
    });
  });
  client.on("error", (error) => {
    spinner.error({
      text: chalk.red(error),
    });
    process.exit(1);
  });
  client.on("close", () => {
    console.log(chalk.red("Connection closed"));
    process.exit(1);
  });
  client.on("offline", () => {
    if (spinner) {
      spinner.error({
        text: chalk.red(
          `Timed out trying to connect to broker mqtt://${host}:${port}`,
        ),
      });
    } else {
      console.log(chalk.red("Connection offline"));
    }
    process.exit(1);
  });
  client.on("reconnect", () => {
    console.log(chalk.yellow("Reconnecting to broker"));
  });
  client.on("message", (topic, message) => {
    console.log(chalk.yellow(`Message received on topic ${topic}`));
    console.log(chalk.yellow(message.toString()));
  });
  return client;
}

await mqttBroker(host, port, username, password);
