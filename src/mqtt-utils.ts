import * as mqtt from "mqtt";
import "dotenv/config";
import chalk from "chalk";
import { createSpinner } from "nanospinner";

async function mqttStartClient(
  host: string,
  port: string,
  username: string,
  password: string,
  clientId = undefined,
) {
  const spinner = createSpinner(
    chalk.blue(`Connecting to mqtt://${host}:${port}...`),
  ).start();

  const client: mqtt.MqttClient = mqtt.connect(`mqtt://${host}:${port}`, {
    username: username,
    password: password,
    connectTimeout: 5000,
    clientId: clientId,
  });

  client.on("connect", () => {
    spinner.success({
      text: chalk.green(
        `Connected to broker mqtt://${host}:${port} as client ${client.options.clientId}`,
      ),
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
    console.log(chalk.red("Reconnecting to broker"));
  });
  client.on("message", (topic, message) => {
    console.log(chalk.yellow(`Message received on topic ${topic}`));
    console.log(chalk.yellow(message.toString()));
  });
  return client;
}

export default mqttStartClient;
