#!/usr/bin/env node

import inquirer from "inquirer";
import minimist from "minimist";

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

// TODO validate number
async function askMeasurements() {
  const { durationPerMeasurement } = await inquirer.prompt({
    type: "input",
    name: "durationPerMeasurement",
    message:
      "How long in ms do you want to send messages for each measurement?",
    default() {
      return "1000";
    },
  });
  return durationPerMeasurement;
}

const args = minimist(process.argv.slice(2), {
  string: ["host", "port", "username", "password", "messagesPerMeasurement"],
  boolean: ["live"],
  alias: {
    h: "host",
    p: "port",
    u: "username",
    P: "password",
    m: "messagesPerMeasurement",
  },
});

export { askUsername, askPassword, askMeasurements, args };
