import chalk from "chalk";
import "dotenv/config";
import * as mqtt from "mqtt";
import { createSpinner } from "nanospinner";

/**
 * Start a client and handle various connection states
 *
 * @param  {string} host
 * @param  {string} port
 * @param  {string} username
 * @param  {string} password
 * @param  {string} clientId
 * @param  {()=>void} onConnect
 */
async function mqttStartClient(
  host: string,
  port: string,
  username: string,
  password: string,
  clientId: string,
  onConnect: () => void,
) {
  let isConnected = false;

  const spinner = createSpinner(
    chalk.blue(`Connecting to ${chalk.yellow(`mqtt://${host}:${port}`)}`),
  ).start();

  // connect to host:port with provided username and password
  const client: mqtt.MqttClient = mqtt.connect(`mqtt://${host}:${port}`, {
    username: username,
    password: password,
    connectTimeout: 5000,
    clientId: clientId,
  });

  // run callback once connected
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
  // handle various client states
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

/**
 * Basic error handling for topic subscriptions
 *
 * @param  {mqtt.MqttClient} client
 * @param  {string} topic
 */
function subscribeToTopic(
  client: mqtt.MqttClient,
  topic: string,
  qos?: mqtt.QoS,
) {
  client.subscribe(topic, { qos: qos || 0 }, function (err) {
    if (err) {
      console.error(`Failed to subscribe to ${topic}: ${err}`);
      process.exit(1);
    }
  });
}

export { mqttStartClient, subscribeToTopic };
