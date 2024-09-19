var numberData = undefined;
var themeSelected = 1;
var numbersArray = [];
var onBusy = false;
var online = false;
var socket; // Declare socket variable
let myID = localStorage.getItem("uuid");
var myTable = undefined;

// Check if UUID exists in localStorage
if (!myID) {
  // Generate a new UUID and save it to localStorage
  myID = generateUUID();
  localStorage.setItem("uuid", myID);
}

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("nickname").value = `${myID}; SUM=${checkSum(myID)}`;
});
document.getElementById("adminurl").addEventListener("click", function () {
  window.location.href = "/admin.html";
});
document.getElementById("btnOK").addEventListener("click", function () {
  const passcode = document.getElementById("passcode").value;
  if (passcode === "") {
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Cần nhập mật mã!",
    });
    return false;
  }
  connectToServer();
  numbersArray = [];
});
document.getElementById("resetID").addEventListener("click", function () {
  myID = generateUUID();
  localStorage.setItem("uuid", myID);
  document.getElementById("nickname").value = `${myID}; SUM=${checkSum(myID)}`;
});

function createTable() {
  const table = document.getElementById("myTable");

  let tableHtml = "<tbody>";
  const colorClass = getRandomColorClass();
  numberData = getNewTable();
  for (let i = 0; i < 9; i++) {
    tableHtml += "<tr>";
    for (let j = 0; j < 9; j++) {
      let randNum = numberData[i][j];
      if (randNum == 0) {
        randNum = "";
      }
      tableHtml += `<td class="${colorClass}"><div class="ratio ratio-1x1"><div class="text-central">${randNum}</div></div></td>`;
    }
    tableHtml += "</tr>";
  }
  tableHtml += "</tbody>";
  table.innerHTML = tableHtml;
}
function getRandomColorClass() {
  const randomIndex = getRandomNumber(1, 10);
  themeSelected = randomIndex;
  return `color-${randomIndex}`;
}

function getRandomNumber(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function getDistinctRandomNumbersInRange() {
  const numbers = new Set();
  while (numbers.size < 5) {
    const randomNumber = Math.floor(Math.random() * 9) + 1;
    numbers.add(randomNumber); // Set automatically handles duplicates
  }
  return Array.from(numbers);
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
function checkBingo() {
  let bingo = false;
  if (myTable === undefined) {
    return bingo;
  }
  myTable.forEach((row) => {
    let numCount = 0;
    let outArray = [];
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
      outArray.sort((a, b) => a - b);
      document.getElementById(
        "txt-server-status"
      ).innerHTML = `BINGO: ${outArray.join(";")}`;
      Swal.fire(
        `BINGO, you are the winner with numbers: ${outArray.join(";")}!`
      );
    } else {
      outArray = [];
    }
  });
  return bingo;
}
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function checkSum(txt) {
  const totalSum = txt
    .replace(/-/g, "") // Remove dashes
    .split("") // Split into individual characters
    .reduce((sum, char) => sum + parseInt(char, 16), 0); // Convert to integer and sum
  return totalSum;
}
// Function to connect to Socket.IO server when button is clicked
function connectToServer() {
  if (online) {
    Swal.fire({
      icon: "warning",
      title: "Oops...",
      text: "Bạn đã kết nối rồi!",
    });
    return false;
  }
  const password = document.getElementById("passcode").value;
  // Connect to Socket.IO server (adjust URL as necessary)
  socket = io(window.location.host, {
    auth: {
      role: "student",
      password: password,
    },
    query: { uuid: myID },
  }); // Update this with your server URL

  // Log a message when connected
  socket.on("connect", () => {
    document.getElementById("txt-server-status").innerText =
      "Connected: " + socket.id;
    console.log("Connected to server:", socket.id);
    online = true;
    document.getElementById("resetID").disabled = true;
  });
  socket.on("studentList", (lst) => {
    document.getElementById(
      "txt-server-status"
    ).innerText = `Có ${lst} người chơi đã kết nối`;
  });
  socket.on("userBingo", (lst) => {
    document.getElementById(
      "txt-end-status"
    ).innerText = `Mã chiến thắng: ${lst}`;
  });
  socket.on("numberPublished", (nums) => {
    numbersArray = nums;
    borderNumberAndCheck();
  });

  socket.on("studentTable", (studentTable) => {
    document.getElementById(
      "txt-end-status"
    ).innerText = `Mã chiến thắng`;
    Swal.close();
    myTable = studentTable;
    const table = document.getElementById("myTable");

    let tableHtml = "<tbody>";
    const colorClass = getRandomColorClass();

    for (let i = 0; i < 9; i++) {
      tableHtml += "<tr>";
      for (let j = 0; j < 9; j++) {
        let randNum = myTable[i][j];
        if (randNum == 0) {
          randNum = "";
        }
        tableHtml += `<td class="${colorClass}"><div class="ratio ratio-1x1"><div class="text-central">${randNum}</div></div></td>`;
      }
      tableHtml += "</tr>";
    }
    tableHtml += "</tbody>";
    table.innerHTML = tableHtml;
  });
  // Handle connection error (authentication failure)
  socket.on("connect_error", (err) => {
    document.getElementById("txt-server-status").innerText =
      "Connection failed: " + err.message;
    console.log("Connection failed:", err.message);
    online = false;
  });
  // Log a message when disconnected
  socket.on("disconnect", () => {
    document.getElementById("txt-server-status").innerText = "Disconnected";
    console.log("Disconnected from server");
    online = false;
  });
}
function borderNumberAndCheck() {
  document.getElementById("txt-current").innerHTML = `${numbersArray.join(
    ";"
  )}`;
  const elements = document.querySelectorAll(".text-central");
  elements.forEach((element) => {
    const eText = element.textContent;
    if (eText !== "") {
      numbersArray.forEach((T) => {
        if (parseInt(eText) == T) {
          if (themeSelected == 1) {
            element.classList.add("text-bordered-3");
          } else if (themeSelected < 4) {
            element.classList.add("text-bordered-2");
          } else {
            element.classList.add("text-bordered-1");
          }
        }
      });
    }
  });
  checkBingo();
}
