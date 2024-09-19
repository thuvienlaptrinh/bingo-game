let HTTP_PORT = 7999;
const path = require("path");
const http = require("http");
const nocache = require("nocache");

const Greenlock = require("greenlock-express"); //Thêm nếu sử dụng SSL
const express = require("express");
const app = express();
const { Server } = require("socket.io");
const cors = require("cors");
const corsOptions = {
  origin: "*",
  methods: "GET,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));
app.set("etag", false);
app.use(nocache());
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});
// Wildcard route: Redirect all other routes to index.html
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
const USE_SSL = false;
if (USE_SSL) {
  Greenlock.init({
    packageRoot: __dirname,
    configDir: "./greenlock.d",
    maintainerEmail: "your-email@example.com",
    staging: false, // Set to true for testing, false for production
    sites: [
      {
        subject: "dangtuanphong.ddns.net",
        altnames: ["dangtuanphong.ddns.net", "www.dangtuanphong.ddns.net"],
      },
    ],
  }).serve(app);
}

const HTTP_SERVER = http
  .createServer(app)
  .listen(HTTP_PORT, "0.0.0.0", function () {
    console.log(`Server listening on localhost:${HTTP_PORT}`);
  });
HTTP_SERVER.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${HTTP_PORT} is already in use. Trying a different port...`
    );
    HTTP_PORT++;
    HTTP_SERVER.listen(HTTP_PORT); // Try the next available port
  } else {
    throw error;
  }
});
const iohttp = new Server(HTTP_PORT, {
  cors: { origin: "*", methods: ["GET", "POST"] },
}).listen(HTTP_SERVER);

let STUDENT_PASSWORD = "vuilen";
const ADMIN_PASSWORD = "admin123";
let bingoArrayNumber = [];
const USERS_LIST = {
  admin: {},
  student: {},
  published: [],
};
iohttp.use((socket, next) => {
  const { role, password } = socket.handshake.auth;
  // Check the role and validate the password
  if (role === "admin" && password === ADMIN_PASSWORD) {
    // Admin authenticated
    socket.join("admin");
    return next();
  } else if (role === "student" && password === STUDENT_PASSWORD) {
    // Student authenticated
    socket.join("student");
    return next();
  }

  // Reject the connection if the password is incorrect
  const err = new Error("Invalid password");
  err.data = { content: "Please retry with the correct password." }; // Optional custom error message
  next(err);
});
iohttp.on("connection", function (socket) {
  const uuid = socket.handshake.query.uuid;
  const role = socket.handshake.auth.role;
  const socketid = socket.id;
  if (role === "admin") {
    const passcode = socket.handshake.query.password;
    STUDENT_PASSWORD = passcode;
  }
  if (USERS_LIST[role][uuid]) {
    USERS_LIST[role][uuid]["socketid"] = socketid;
  } else {
    USERS_LIST[role][uuid] = {
      role: role,
      table: [],
      socketid: socketid,
    };
  }
  if (USERS_LIST[role][uuid]["table"].length > 0) {
    // Gửi lại user bảng đang chơi
    const studentSocketID = USERS_LIST[role][uuid]["socketid"];
    const studentSavedTable = USERS_LIST[role][uuid]["table"];
    const targetSocket = iohttp.sockets.sockets.get(studentSocketID);
    if (targetSocket) {
      targetSocket.emit("studentTable", studentSavedTable);
      targetSocket.emit("published", USERS_LIST.published);
      //console.log(`Message sent to socket ${studentSocketID}`);
    } else {
      console.log(`Socket with ID ${studentSocketID} not found.`);
    }
  }

  socket.on("getUserList", function () {
    socket.emit("studentList", getStudentCount("student"));
  });
  // Nhận lệnh tạo game mới
  socket.on("createNewGame", function () {
    USERS_LIST.published = [];
    for (const key in USERS_LIST["student"]) {
      if (Object.prototype.hasOwnProperty.call(USERS_LIST["student"], key)) {
        const currentStudent = USERS_LIST["student"][key];
        const studentTable = getNewTable();
        currentStudent["table"] = studentTable;
        const studentSocketID = currentStudent["socketid"];
        const targetSocket = iohttp.sockets.sockets.get(studentSocketID);
        if (targetSocket) {
          targetSocket.emit("studentTable", studentTable);
          targetSocket.emit("numberPublished", USERS_LIST.published);
          iohttp.emit("numberPublished", []);
          //console.log(`Message sent to socket ${studentSocketID}`);
        } else {
          console.log(`Socket with ID ${studentSocketID} not found.`);
        }
      }
    }
  });

  // Gửi danh sách user tới admin
  iohttp.emit("studentList", getStudentCount("student"));
  // Listen for role-specific messages
  socket.on("adminMessage", (msg) => {
    // Only broadcast to users in the 'admin' room
    iohttp.to("admin").emit("adminMessage", msg);
  });
  socket.on("getNextNumber", getNextNumber);

  socket.on("studentMessage", (msg) => {
    // Only broadcast to users in the 'student' room
    iohttp.to("student").emit("studentMessage", msg);
    // Emit a welcome message to the specific client
    iohttp.to(socket.id).emit("message", "This message is sent only to you!");
  });

  socket.on("disconnect", () => {
    const socketid = socket.id;
    for (const key in USERS_LIST["admin"]) {
      if (Object.prototype.hasOwnProperty.call(USERS_LIST["admin"], key)) {
        if (USERS_LIST["admin"][key]["socketid"] == socketid) {
          delete USERS_LIST["admin"][key];
        }
      }
    }
    for (const key in USERS_LIST["student"]) {
      if (Object.prototype.hasOwnProperty.call(USERS_LIST["student"], key)) {
        if (USERS_LIST["student"][key]["socketid"] == socketid) {
          delete USERS_LIST["student"][key];
        }
      }
    }
    console.log("User disconnected", USERS_LIST);
    socket.emit("studentList", getStudentCount("student"));
    iohttp.emit("studentList", getStudentCount("student"));
  });
});
function getStudentCount(role) {
  const studentCount = Object.keys(USERS_LIST[role]).length;
  return studentCount;
}

function getRandomNumber(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function getNewTable() {
  const array9x9 = Array.from({ length: 9 }, () => Array(9).fill(0));
  const retTable = [];
  for (let hang = 0; hang < 9; hang++) {
    const numbers = new Set();
    const rowNums = [];
    while (numbers.size < 5) {
      const randomNumber = getRandomNumber(0, 8);
      numbers.add(randomNumber); // Set automatically handles duplicates
    }
    numbers.forEach((number) => {
      let insertNumber = number * 10 + getRandomNumber(0, 9);
      if (insertNumber == 0) insertNumber = 1;
      while (retTable.includes(insertNumber)) {
        insertNumber = number * 10 + getRandomNumber(0, 9);
      }
      rowNums.push(insertNumber);
      retTable.push(insertNumber);
    });
    rowNums.sort((a, b) => a - b);
    rowNums.forEach((rowNum) => {
      const firstPart = Math.floor(rowNum / 10);
      array9x9[hang][firstPart] = rowNum;
    });
  }
  return array9x9;
}
function getNextNumber() {
  let newNumber = getRandomNumber(1, 99);
  const drawedNums = USERS_LIST.published;
  while (drawedNums.includes(newNumber)) {
    newNumber = getRandomNumber(1, 99);
  }
  drawedNums.push(newNumber);
  if (iohttp) {
    iohttp.emit("numberPublished", drawedNums);
  } else {
    console.log("Error iohttp");
  }
  // Check bingo all user
  for (const key in USERS_LIST["student"]) {
    if (Object.prototype.hasOwnProperty.call(USERS_LIST["student"], key)) {
      const currentUser = USERS_LIST["student"][key];
      const checkResult = checkBingo(currentUser.table, drawedNums);
      if (checkResult.bingo == true) {
        console.log("Bingo", bingoArrayNumber);
        const userKey = currentUser.socketid;
        iohttp.to("admin").emit("userBingo", [`${key}; SUM=${checkSum(key)}`, bingoArrayNumber, userKey]);
        const targetSocket = iohttp.sockets.sockets.get(userKey);
        if (targetSocket) {
          targetSocket.emit("userBingo", userKey);
          //console.log(`Message sent to socket ${studentSocketID}`);
        } else {
          console.log(`Socket with ID ${userKey} not found.`);
        }
      }
    }
  }
}
function checkBingo(myTable, numbersArray) {
  let bingo = false;
  let outArray = [];
  if (myTable === undefined) {
    return bingo;
  }
  myTable.forEach((row) => {
    let numCount = 0;
    outArray = [];
    row.forEach((n) => {
      if (n > 0) {
        numbersArray.forEach((number) => {
          if (number == n) {
            numCount++;
            outArray.push(number);
          }
        });
      }
    });
    if (numCount == 5) {
      bingo = true;
      outArray.sort((a, b) => a - b);
      bingoArrayNumber = outArray;
      return {
        bingo,
        outArray,
      };
    } else {
      outArray = [];
    }
  });
  return {
    bingo,
    outArray,
  };
}
function checkSum(txt) {
  const totalSum = txt
    .replace(/-/g, "") // Remove dashes
    .split("") // Split into individual characters
    .reduce((sum, char) => sum + parseInt(char, 16), 0); // Convert to integer and sum
  return totalSum;
}