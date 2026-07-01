const path = require("path");

const isDev = process.env.NODE_ENV === "development";
const nrDir = isDev ? __dirname : path.join(process.resourcesPath, "nr");

module.exports = {
  uiHost: "127.0.0.1",
  uiPort: 1880,
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
