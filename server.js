const express = require("express");
const app = express();

const testRoute = require("./route");

app.use(express.json());

// Use route
app.use("/api", testRoute);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
