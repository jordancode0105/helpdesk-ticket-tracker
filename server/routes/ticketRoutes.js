const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Get all tickets route" });
});

router.post("/", (req, res) => {
  res.json({ message: "Create ticket route" });
});

router.get("/:id", (req, res) => {
  res.json({ message: `Get ticket ${req.params.id} route` });
});

router.put("/:id", (req, res) => {
  res.json({ message: `Update ticket ${req.params.id} route` });
});

router.delete("/:id", (req, res) => {
  res.json({ message: `Delete ticket ${req.params.id} route` });
});

router.post("/:id/comments", (req, res) => {
  res.json({ message: `Add comment to ticket ${req.params.id} route` });
});

module.exports = router;
