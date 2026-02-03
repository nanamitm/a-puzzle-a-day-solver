"use strict";

const webpack = require("webpack");
const DevServer = require("webpack-dev-server");
const config = require("../webpack.config");

async function start() {
  const compiler = webpack(config);
  const options = config.devServer || {};
  const server = new DevServer(options, compiler);

  await server.start();

  const { host, port } = server.options;
  const shownHost = host || "localhost";
  console.log(`Dev server running at http://${shownHost}:${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
