var numberData = undefined;
var themeSelected = 1;
var numbersArray = [];
var onBusy = false;
var online = false;
var socket; // Declare socket variable
let myID = localStorage.getItem("uuid");
// Check if UUID exists in localStorage

if (!myID) {
  // Generate a new UUID and save it to localStorage
  myID = generateUUID();
  localStorage.setItem("uuid", myID);
}

document.addEventListener("DOMContentLoaded", function () {
  //document.getElementById("nickname").value = `${myID}; SUM=${checkSum(myID)}`;
});
document.getElementById("btnOK").addEventListener("click", function () {
  const passcode = document.getElementById("passcode").value;
  const admincode = document.getElementById("admincode").value;
  if (passcode === "") {
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Cần nhập mật mã!",
    });
    return false;
  }
  if (admincode === "") {
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Cần nhập mật mã admin!",
    });
    return false;
  }
  connectToServer();
  //createTable();
  numbersArray = [];
});
document.getElementById("resetID").addEventListener("click", function () {
  myID = generateUUID();
  localStorage.setItem("uuid", myID);
});
document.getElementById("getUser").addEventListener("click", function () {
  if (socket) {
    socket.emit("getUserList");
  }
});
document.getElementById("btnNewGame").addEventListener("click", function () {
  if (socket) {
    socket.emit("createNewGame");
  }
  const table = document.getElementById("myTable");
  let tableHtml = "<tbody>";
  tableHtml += "<tr>";
  tableHtml += `<th>UUID</th><th>Dãy số</th><th>Mã chiến thắng</th>`;
  tableHtml += "</tr>";
  tableHtml += "</tbody>";
  table.innerHTML = tableHtml;
  document.getElementById("btnNext").disabled = false;
});

document.getElementById("btnNext").addEventListener("click", function () {
  if (socket) {
    socket.emit("getNextNumber");
  }
});

function getRandomNumber(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
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
  const admincode = document.getElementById("admincode").value;
  // Connect to Socket.IO server (adjust URL as necessary)
  socket = io(window.location.host, {
    auth: {
      role: "admin",
      password: admincode,
    },
    query: { uuid: myID, password: password },
  }); // Update this with your server URL

  // Log a message when connected
  socket.on("connect", () => {
    document.getElementById("txt-server-status").innerText =
      "Connected: " + socket.id;
    console.log("Connected to server:", socket.id);
    online = true;
    document.getElementById("resetID").disabled = true;
  });
  // Nhận danh sách user
  socket.on("studentList", (lst) => {
    document.getElementById(
      "adminstatus"
    ).innerText = `Có ${lst} người chơi đã kết nối`;
  });
  socket.on("numberPublished", (nums) => {
    numbersArray = nums;
    document.getElementById("txt-current").innerHTML = `${numbersArray.join(
      ";"
    )}`;
  });
  // Nhận người dùng trúng thưởng
  socket.on("userBingo", (lst) => {
    console.log(lst);
    const table = document.getElementById("myTable");
    // Insert a new row at the end of the table
    const newRow = table.insertRow();
    // Insert new cells for Name and Age
    const nameCell = newRow.insertCell(0);
    const ageCell = newRow.insertCell(1);
    const codeCell = newRow.insertCell(2);
    // Add the values from the input fields to the new cells
    nameCell.innerHTML = lst[0];
    ageCell.innerHTML = lst[1].join(";");
    codeCell.innerHTML = lst[2];
    document.getElementById("btnNext").disabled = true;
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
