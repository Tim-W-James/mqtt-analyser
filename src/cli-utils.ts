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

const args = minimist(process.argv.slice(2), {
  string: ["host", "port", "username", "password"],
  alias: { h: "host", p: "port", u: "username", P: "password" },
});

export { askUsername, askPassword, args };
