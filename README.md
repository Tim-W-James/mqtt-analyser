<!--
*** README forked from the Best-README-Template: https://github.com/othneildrew/Best-README-Template
*** Forked by Tim James: https://github.com/Tim-W-James/README-Template
***
-->

<!-- PROJECT LOGO -->
<br />
<p align="center">
  <!-- <a href="https://github.com/Tim-W-James/mqtt-analyser">
    <img src="images/logo.png" alt="Logo" width="80" height="80">
  </a> -->

  <h2 align="center">MQTT Analyser</h2>

  <p align="center">
    Analyses the performance of an MQTT Broker
    <br />
<!--     <a href="https://github.com/Tim-W-James/mqtt-analyser"><strong>Explore the docs »</strong></a>
    <br />
    <br /> -->
<!--     <a href="https://github.com/Tim-W-James/mqtt-analyser">View Demo</a> -->
<!--     ·
    <a href="https://github.com/Tim-W-James/mqtt-analyser/issues">Report Bug</a> -->
<!--     ·
    <a href="https://github.com/Tim-W-James/mqtt-analyser/issues">Request Feature</a> -->
  </p>
</p>

<!-- TABLE OF CONTENTS -->
<details open="open">
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#features">Features</a></li>
        <li><a href="#built-with">Built With</a></li>
        <li><a href="#project-structure">Project Structure</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li>
        <a href="#usage">Usage</a>
        <ul>
        <li><a href="#examples">Examples</a></li>
        </ul>
    </li>
<!--     <li><a href="#roadmap">Roadmap</a></li> -->
<!--     <li><a href="#contributing">Contributing</a></li> -->
    <!-- <li><a href="#license">License</a></li> -->
    <!-- <li><a href="#contact">Contact</a></li> -->
<!--     <li><a href="#acknowledgements">Acknowledgements</a></li> -->
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

<!-- [![mqtt-analyser Screen Shot][product-screenshot]](https://example.com) -->

Collects various metrics to test the performance of an MQTT broker. This is achieved with two components:

* A **publisher/controller** which subscribes to the following topics: `request/qos` and `request/delay`. The publisher will use these values to send messages with that Quality of Service (QoS) value and inter-message delay. These messages are sent to the topic `counter/<qos>/<delay>` with an incrementing counter within a specified duration.
* An **analyser**, which goes through each QoS/delay value combination and publishes these values to `request/qos` and `request/delay`. It subscribes to topic `counter/<qos>/<delay>`, and calculates various metrics from the messages it receives. The analyser will iterate across each QoS/delay value combination, collecting results for a given QoS/delay value pair for a specified duration before moving on to the next combination. Finally, the metrics will be printed to the console as a results table.

### Features

* The analyser collects the calculates the following metrics:
  * Average Rate (messages/second)
  * Message Loss (%)
  * Messages Out-of-Order (%)
  * Mean Inter-Message-Gap (ms)
  * Median Inter-Message-Gap (ms)
* QoS values are `0`, `1`, or `2`
* Delay values (ms) are `0`, `1`, `2`, `10`, `20`, `100`, or `200`
* Example output from the analyser with a duration per measurement of 10 seconds:

  ```sh
  Average Rate (messages/second):
  Delay     0     1     2    10    20   100   200 
  -----------------------------------------------
  QoS 0  8024  8118  4496   973   494    99    49 
  QoS 1  8047  8325  4488   974   492    99    49 
  QoS 2  8350  8517  4465   977   494    99    49 

  Message Loss (%):
  Delay     0     1     2    10    20   100   200 
  -----------------------------------------------
  QoS 0     0     0     0     0     0     0     0 
  QoS 1     0     0     0     0     0     0     0 
  QoS 2     0     0     0     0     0     0     0 

  Messages Out-of-Order (%):
  Delay     0     1     2    10    20   100   200 
  -----------------------------------------------
  QoS 0     0     0     0     0     0     0     0 
  QoS 1     0     0     0     0     0     0     0 
  QoS 2     0     0     0     0     0     0     0 

  Mean Inter-Message-Gap (ms):
  Delay     0     1     2    10    20   100   200 
  -----------------------------------------------
  QoS 0     1     1     2    10    20   100   200 
  QoS 1     1     1     2    10    20   100   200 
  QoS 2     1     1     2    10    20   100   200 

  Median Inter-Message-Gap (ms):
  Delay     0     1     2    10    20   100   200 
  -----------------------------------------------
  QoS 0     1     1     2    10    20   100   200 
  QoS 1     1     0     2    10    20   100   200 
  QoS 2     1     0     2    10    20   100   200 
  ```

### Built With

* [Node.js](https://nodejs.org/en/)
* [TypeScript](https://www.typescriptlang.org/)
* [mqtt.js](https://www.npmjs.com/package/mqtt) - MQTT library for JavaScript

### Project Structure

* `./src`: source code
* `./dist`: compiled `node.js` executables

<!-- ### Limitations -->

<!-- GETTING STARTED -->
## Getting Started

### Prerequisites

* **npm** - built and tested with node `16.13.2`
  * Install [`node.js`](https://nodejs.org/en/download/)
  * Or use Node Version Manager (nvm) to detect and use the correct node version for the project with: `nvm use`

### Installation

1. Install dependencies

   ```sh
   npm install
   ```

2. Build (note that prebuilt files are provided in `./dist`)

    ```sh
    npm run build
    ```

<!-- USAGE -->

## Usage

* The publisher and analyser run as separate executables. Start the analyser first (the QoS and delay values are retained), and wait until you see the following log before starting the publisher: `Waiting for messages on topic counter/0/0`.
* To start the publisher/controller:

  ```sh
  npm run start-publisher
  ```

* To start the analyser:

  ```sh
  npm run start-analyser
  ```

* By default, the client will try to connect to the host `localhost` on port `1883`, and prompt the user for a username and password combination. A duration (ms) for each QoS/delay value pair must also be specified, and this **must be the same for both the publisher and analyser**.
* Arguments can either be specified via the command line or sources from a `.env` file:

  | CLI argument                | `.env` variable            | Default value |
  | --------------------------- | -------------------------- | ------------- |
  | `--host=`                   | `MQTT_HOST`                | localhost     |
  | `--port=`                   | `MQTT_PORT`                | 1883          |
  | `--username=`               | `MQTT_USERNAME`            |               |
  | `--password=`               | `MQTT_PASSWORD`            |               |
  | `--durationPerMeasurement=` | `DURATION_PER_MEASUREMENT` | 1000          |

### Examples

* Start a publisher on `mqtt://localhost:1883` with the username `admin` and password `123`, taking measurements for 10 seconds per QoS/delay combination:

  ```sh
  npm run start-publisher -- --host=localhost --port=1883 --username='admin' --password='123' --durationPerMeasurement=10000
  ```

* Start a analyser with the same arguments:

  ```sh
  npm run start-analyser -- --host=localhost --port=1883 --username='admin' --password='123' --durationPerMeasurement=10000
  ```

* Example `.env` file:

  ```sh
  MQTT_HOST="localhost"
  MQTT_PORT="1883"
  MQTT_USERNAME="admin"
  MQTT_PASSWORD="123"
  DURATION_PER_MEASUREMENT="10000"
  ```

<!-- USEFUL LINKS FOR MARKDOWN
* https://github.com/Tim-W-James/blog/blob/master/Markdow-Cheatsheet.md
* https://www.markdownguide.org/basic-syntax
* https://www.webpagefx.com/tools/emoji-cheat-sheet
* https://shields.io
* https://choosealicense.com
* https://pages.github.com
* https://daneden.github.io/animate.css
* https://connoratherton.com/loaders
* https://kenwheeler.github.io/slick
* https://github.com/cferdinandi/smooth-scroll
* http://leafo.net/sticky-kit
* http://jvectormap.com
* https://fontawesome.com -->
