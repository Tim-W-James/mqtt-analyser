import * as mqtt from "mqtt";
import "dotenv/config";
import chalk from "chalk";
import { createSpinner } from "nanospinner";

async function mqttStartClient(
  host: string,
  port: string,
  username: string,
  password: string,
  clientId: string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  onConnect: Function,
) {
  let isConnected = false;
  const spinner = createSpinner(
    // eslint-disable-next-line sonarjs/no-nested-template-literals
    chalk.blue(`Connecting to ${chalk.yellow(`mqtt://${host}:${port}`)}`),
  ).start();

  const client: mqtt.MqttClient = mqtt.connect(`mqtt://${host}:${port}`, {
    username: username,
    password: password,
    connectTimeout: 5000,
    clientId: clientId,
  });

  client.on("connect", () => {
    isConnected = true;
    spinner.success({
      text: chalk.green(
        `Connected to broker ${chalk.yellow(
          `mqtt://${host}:${port}`,
        )} with client ID ${chalk.yellow(client.options.clientId)}`,
      ),
    });
    onConnect();
  });
  client.on("error", (error) => {
    spinner.error({
      text: chalk.red(error),
    });
    process.exit(1);
  });
  client.on("close", () => {
    console.error("Connection closed");
    process.exit(1);
  });
  client.on("offline", () => {
    if (!isConnected) {
      spinner.error({
        text: chalk.red(
          `Timed out trying to connect to broker mqtt://${host}:${port}`,
        ),
      });
    } else {
      console.error("Connection offline");
    }
    process.exit(1);
  });
  client.on("reconnect", () => {
    console.warn("Reconnecting to broker");
  });
  return client;
}

function subscripeToTopic(client: mqtt.MqttClient, topic: string) {
  client.subscribe(topic, function (err) {
    if (err) {
      console.error(`Failed to subscribe to ${topic}: ${err}`);
      process.exit(1);
    }
  });
}

// TODO convert to class
const delayValues = [0, 1, 2, 10, 20, 100, 200] as const;
type publishDelay = typeof delayValues[number];

function nextDelay(delay: publishDelay) {
  return delayValues[(delayValues.indexOf(delay) + 1) % delayValues.length];
}

function isValidDelay(delay: number) {
  return delayValues.includes(delay as publishDelay);
}

function sleep(ms: number | undefined) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export {
  mqttStartClient,
  subscripeToTopic,
  publishDelay,
  nextDelay,
  isValidDelay,
  delayValues,
  sleep,
};
