const path = require("path");
const fs = require("fs");
const isDev = process.env.NODE_ENV === "development";
const nrDir = 'C:/switch/node-red-vue/nr'

module.exports = {
  // uiHost: "127.0.0.1",
  // https: {
  //   key: fs.readFileSync("privkey.pem"),
  //   cert: fs.readFileSync("cert.pem"),
  // },
  uiHost: "0.0.0.0",
  uiPort: "1880",
  flowFile: path.join(nrDir, "flows.json"),
  flowFilePretty: true,
  httpAdminRoot: "/",
  httpNodeRoot: "/",
  httpNodeCors: {
    origin: "*",
    methods: "GET,POST,PUT,DELETE,OPTIONS",
  },
  credentialSecret: "switch-machine-2024",
  // disableEditor: !isDev,
  disableEditor: false,
  logging: {
    console: { level: "info", metrics: false, audit: false },
  },
  contextStorage: {
    default: "memory",
    memory: { module: "memory" },
    file: { module: "localfilesystem" },
  },
  functionGlobalContext: {
    path: require("path"),
    fs: require("fs"),
    rootPath: nrDir,
  },
};
