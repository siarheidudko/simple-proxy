const { createServer, createConnection, Socket } = require("net");
const { watchFile, readFile } = require("fs");
const { normalize, join } = require("path");
const cluster = require("cluster");

class Proxy {
  constructor({ path = join(__dirname, "..", ".keys") }) {
    this.keyFilePath = normalize(path);
    this.updateKeys();
    this.watchKeyFile();
  }

  /**
   * @type string
   */
  keyFilePath;

  tokenReg = new RegExp("\\r\\nAPI-KEY:\\s*(\\w|\\d|-|_|=)*\\s*\\r\\n", "gi");

  ip2ban = {};

  /**
   * @type {String[]} - array of the access tokens
   */
  keys = [];

  watchKeyFile = () => {
    watchFile(this.keyFilePath, () => {
      this.updateKeys();
    });
  };

  updateKeys = () => {
    readFile(this.keyFilePath, (err, data) => {
      try {
        if (err) {
          console.log(err);
          return;
        }
        const keys = data
          .toString()
          .split("\n")
          .map((e) => e.trim().replace(/(\r|\t)/gi, ""))
          .filter((e) => e.length > 0);
        this.keys = keys;
      } catch (err) {
        console.error(err);
      }
    });
  };

  /**
   *
   * @param {Socket} inp - income socket
   */
  rejectConnection = (inp) => {
    setTimeout(() => {
      console.log("Invalid Token");
    }, 0);
    inp.write(Buffer.from("Forbidden"));
    inp.end();
  };

  /**
   * Create proxy server
   *
   * @param {Object} param0
   * @param {String} param0.host - remote server host
   * @param {Number} param0.port - remote server port
   */
  createServer = ({
    port = 8000,
    maxListeners = 0,
    remoteHost = "google.com",
    remotePort = 80,
  }) => {
    const self = this;
    createServer((inp) => {
      let state = [];
      inp
        .setMaxListeners(maxListeners)
        .on("data", (buf) => {
          state.push(buf);
          if (inp.isPaused) {
            const body = Buffer.concat(state).toString();
            setTimeout(() => {
              console.log(`Income: `, body);
            }, 0);
            const [head] = body.match(self.tokenReg) ?? [];
            if (!head) {
              self.rejectConnection(inp);
              return;
            }
            const token = head.replace(/(\s|\r|\n)/g, "").split(":")[1];
            if (!token || !self.keys.includes(token)) {
              self.rejectConnection(inp);
              return;
            }
            const out = createConnection({ host: remoteHost, port: remotePort })
              .setMaxListeners(maxListeners)
              .on("error", (err) => {
                console.error("Outgoing socket error: ", err);
              });
            inp.once("close", () => {
              if (!out.closed) out.end();
            });
            out.pipe(inp);
            out.once("close", () => {
              if (!inp.closed) inp.end();
            });
            state.forEach((e) => out.write(e));
            state = [];
          }
        })
        .on("error", (err) => {
          console.error("Income socket error: ", err);
        });
    })
      .setMaxListeners(maxListeners)
      .listen(port);
  };
}

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  const numWorkers = process.env.PROXY_WORKERS
    ? Number.parseInt(process.env.PROXY_WORKERS)
    : 4;

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  new Proxy({ path: process.env.PROXY_KEY_FILE }).createServer({
    port: process.env.PROXY_PORT
      ? Number.parseInt(process.env.PROXY_PORT)
      : 8000,
    maxListeners: process.env.PROXY_MAX_LISTENERS
      ? Number.parseInt(process.env.PROXY_MAX_LISTENERS)
      : 0,
    remoteHost: process.env.REMOTE_HOST,
    remotePort: process.env.REMOTE_PORT
      ? Number.parseInt(process.env.REMOTE_PORT)
      : 80,
  });

  console.log(`Worker ${process.pid} started`);
}
